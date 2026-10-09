# SoundSight backend

From `backend/`, create and activate a virtual environment, then install dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

The server runs at `http://localhost:8000`. Stop it with Ctrl+C.
`GET /health` returns `{"status":"ok"}`; API documentation is at `/docs`.

`/ws/listen` accepts WebSocket text messages. Send `{"type":"ping"}` to receive
`{"type":"pong"}`. Invalid JSON or unsupported message types return an error
message while keeping the connection open. This endpoint currently checks
connectivity; it does not process audio.

Run tests from `backend/` with the environment activated:

```bash
python -m pytest
```
