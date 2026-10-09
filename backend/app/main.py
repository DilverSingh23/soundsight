from fastapi import FastAPI

from app.tts import router as tts_router

app = FastAPI(title="SoundSight API")

app.include_router(tts_router)

@app.get("/health")
def health():
    return {"status": "ok"}