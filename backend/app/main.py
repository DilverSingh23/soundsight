import json

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from app.tts import router as tts_router

app = FastAPI(title="SoundSight API")

app.include_router(tts_router)

@app.get("/health")
def health():
    return {"status": "ok"}


@app.websocket("/ws/listen")
async def listen(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            text = await websocket.receive_text()
            try:
                message = json.loads(text)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Expected JSON."})
                continue
            if isinstance(message, dict) and message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            else:
                await websocket.send_json({"type": "error", "message": "Expected a ping message."})
    except WebSocketDisconnect:
        pass
