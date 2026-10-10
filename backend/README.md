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

`/ws/listen` accepts JSON control messages and binary audio. Ping/pong remains
available for connection checks. To stream audio:

1. Send `{"type":"start","encoding":"pcm_s16le","sample_rate":16000,"channels":1}`.
2. Wait for `{"type":"ready"}`.
3. Send binary mono signed 16-bit little-endian PCM, normally 3200 bytes per
   100 ms chunk. Empty, odd-sized, or >32000-byte messages are rejected.
4. After each ~500 ms of received samples, the server returns `audio_stats` with
   cumulative `chunks`, `bytes`, `duration_seconds` and interval `rms`/`peak`
   normalized to 0–1. Each connection has separate counters.
5. Close the WebSocket to stop. Disconnecting releases session state.

Malformed input returns `{"type":"error","message":"..."}`. Audio is processed
only to calculate reception statistics, then discarded; no recording is saved.
RMS and peak prove a signal is present, not sound classification or transcription.

Run tests from `backend/` with the environment activated:

```bash
python -m pytest
```
