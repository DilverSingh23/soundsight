from fastapi import FastAPI

app = FastAPI(title="SoundSight API")

@app.get("/health")
def health():
    return {"status": "ok"}