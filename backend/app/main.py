import asyncio
from contextlib import asynccontextmanager, suppress
import json
import os
import time
import math
import struct

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import FRONTEND_ORIGIN
from app.tts import router as tts_router

from app.audio.windows import AudioWindowBuffer
from app.audio.yamnet import YamnetClassifier
from app.events.sound_notifications import SoundNotificationFilter


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.classifier = None
    app.state.inference_lock = asyncio.Lock()
    model_directory = os.getenv("YAMNET_MODEL_DIR", "")
    app.state.classification_status = {"type": "classification_status", "state": "disabled", "message": "YAMNet is not configured."}
    if model_directory:
        try:
            app.state.classifier = await asyncio.to_thread(YamnetClassifier, model_directory)
            app.state.classification_status = {"type": "classification_status", "state": "ready", "message": "YAMNet classification diagnostics enabled."}
        except Exception:
            app.state.classification_status = {"type": "classification_status", "state": "error", "message": "YAMNet could not load. Check model path and Python dependencies."}
    yield
    app.state.classifier = None


app = FastAPI(title="SoundSight API", lifespan=lifespan)

# Only the type-to-speak fetch needs this; the microphone WebSocket isn't CORS-gated.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)

app.include_router(tts_router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.websocket("/ws/listen")
async def listen(websocket: WebSocket):
    await websocket.accept()
    streaming = False
    chunks = 0
    total_bytes = 0
    energy = 0.0
    peak = 0.0
    interval_samples = 0

    windows = AudioWindowBuffer()
    notification_filter = SoundNotificationFilter()
    pending = asyncio.Queue(maxsize=1)
    send_lock = asyncio.Lock()
    classifier_task = None

    async def send(event: dict):
        async with send_lock:
            await websocket.send_json(event)

    async def classify_windows():
        try:
            while True:
                window = await pending.get()
                async with app.state.inference_lock:
                    began = time.perf_counter()
                    inference = asyncio.create_task(asyncio.to_thread(app.state.classifier.classify, window.pcm))
                    try:
                        results = await asyncio.shield(inference)
                    except asyncio.CancelledError:
                        # A running TensorFlow call cannot be canceled; retain the
                        # shared lock until it exits before releasing this session.
                        with suppress(Exception):
                            await inference
                        raise
                await send({
                    "type": "classification",
                    "window_start": window.start_seconds,
                    "window_end": window.end_seconds,
                    "inference_ms": round((time.perf_counter() - began) * 1000, 1),
                    "results": results,
                })
                for result in results:
                    event = notification_filter.process(
                        category=result["category"],
                        score=result["score"],
                        audio_time=window.end_seconds,
                        subtype=result["subtype"],
                    )
                    if event is not None:
                        await send(event)
        except asyncio.CancelledError:
            raise
        except Exception:
            with suppress(Exception):
                await send({"type": "classification_status", "state": "error", "message": "Sound classification stopped; audio reception remains active."})

    async def error(message: str):
        await send({"type": "error", "message": message})

    try:
        while True:
            incoming = await websocket.receive()
            if incoming["type"] == "websocket.disconnect":
                break
            audio = incoming.get("bytes")
            if audio is not None:
                if not streaming:
                    await error("Send a valid start message before audio.")
                    continue
                # Bound work per message and reject malformed 16-bit sample frames.
                if not audio or len(audio) % 2 or len(audio) > 32000:
                    await error("Audio must contain 1–16000 signed 16-bit PCM samples.")
                    continue
                if classifier_task is not None and not classifier_task.done():
                    for window in windows.feed(audio):
                        # Keep only the newest pending window if inference falls behind.
                        if pending.full():
                            pending.get_nowait()
                        pending.put_nowait(window)
                chunks += 1
                total_bytes += len(audio)
                for (sample,) in struct.iter_unpack("<h", audio):
                    normalized = sample / 32768.0
                    energy += normalized * normalized
                    peak = max(peak, abs(normalized))
                interval_samples += len(audio) // 2
                # Report levels over ~500 ms instead of rendering every audio chunk.
                if interval_samples >= 8000:
                    await send({
                        "type": "audio_stats",
                        "chunks": chunks,
                        "bytes": total_bytes,
                        "duration_seconds": total_bytes / 32000,
                        "rms": math.sqrt(energy / interval_samples),
                        "peak": peak,
                    })
                    energy = peak = 0.0
                    interval_samples = 0
                continue

            try:
                message = json.loads(incoming.get("text", ""))
            except json.JSONDecodeError:
                await error("Expected JSON.")
                continue
            if not isinstance(message, dict):
                await error("Expected a JSON object.")
            elif message.get("type") == "ping":
                await send({"type": "pong"})
            elif message.get("type") == "start":
                if streaming:
                    await error("Audio stream already started.")
                elif (message.get("encoding") != "pcm_s16le"
                      or message.get("sample_rate") != 16000
                      or type(message.get("channels")) is not int
                      or message.get("channels") != 1):
                    await error("Expected mono 16 kHz pcm_s16le audio.")
                else:
                    streaming = True
                    await send({"type": "ready"})
                    await send(app.state.classification_status)
                    if app.state.classifier is not None:
                        classifier_task = asyncio.create_task(classify_windows())
            else:
                await error("Expected a ping or start message.")
    except WebSocketDisconnect:
        pass
    finally:
        if classifier_task is not None:
            classifier_task.cancel()
            with suppress(asyncio.CancelledError):
                await classifier_task
