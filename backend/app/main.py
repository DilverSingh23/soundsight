import json
import math
import struct

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import SOUNDSIGHT_ALLOWED_ORIGINS
from app.deepgram_auth import router as deepgram_router

from app.tts import router as tts_router

app = FastAPI(title="SoundSight API")

# Allow specified frontend origins to call the token API in development.
# This is NOT authentication; protect the token endpoint before deploying.
app.add_middleware(
    CORSMiddleware,
    allow_origins=SOUNDSIGHT_ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(tts_router)
app.include_router(deepgram_router)


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

    async def error(message: str):
        await websocket.send_json({"type": "error", "message": message})

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
                chunks += 1
                total_bytes += len(audio)
                for (sample,) in struct.iter_unpack("<h", audio):
                    normalized = sample / 32768.0
                    energy += normalized * normalized
                    peak = max(peak, abs(normalized))
                interval_samples += len(audio) // 2
                # Report levels over ~500 ms instead of rendering every audio chunk.
                if interval_samples >= 8000:
                    await websocket.send_json({
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
                await websocket.send_json({"type": "pong"})
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
                    await websocket.send_json({"type": "ready"})
            else:
                await error("Expected a ping or start message.")
    except WebSocketDisconnect:
        pass
