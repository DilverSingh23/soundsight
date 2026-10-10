# SoundSight backend

From `backend/`, create and activate a virtual environment, then install dependencies:

```bash
python3.13 -m venv .venv
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
for reception statistics and optional YAMNet inference; no recording is saved.
RMS and peak prove a signal is present, not sound classification or transcription.

Run tests from `backend/` with the environment activated:

```bash
python -m pytest
```

## Local YAMNet diagnostics

Use the same Python 3.13 `.venv` for the entire backend, including TensorFlow.
From `backend/`:

```bash
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python scripts/download_yamnet.py
YAMNET_MODEL_DIR=.models/yamnet python -m uvicorn app.main:app --reload
```

The model and environment are ignored by Git. The download requires internet;
inference runs locally afterward. You can also set `YAMNET_MODEL_DIR` in `.env`.
Start the frontend normally, click Start Listening, and expand its diagnostics.
YAMNet status and category scores should update as you speak or play sounds.

Each stream buffers 0.975-second windows with 0.48-second hops. PCM samples are
normalized into float32 values before inference. The model is loaded and warmed
up once at startup; inference runs off the async event loop. Each connection
keeps only the newest pending window if classification falls behind.

After `ready`, the server sends `classification_status` (`ready`, `disabled`,
or `error`). Enabled streams also receive `classification` messages containing
`window_start`, `window_end` (seconds since streaming began), `inference_ms`, and
`results`: category, subtype, score, and raw YAMNet class name. These are
diagnostics for speech, sirens, doorbells, barking, and horns, not notifications
or confirmed detections. A model failure leaves audio reception active.

The wrapper reads the model's 521-class label map rather than hardcoding score
indexes. Embeddings and spectrograms are unused. Notification thresholds,
cooldowns, speech sessions, and the teammate's filter are still separate work.
The siren subtype score/margin rules are provisional diagnostic choices.
