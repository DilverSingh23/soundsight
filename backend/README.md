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
Start the frontend normally and click Start Listening. Accepted sound events
appear in an eight-second in-app banner and the recognized-sounds history on
Home and Alerts. Expand diagnostics to see raw category scores. Sample activity
is separate from real results. History is capped at 100 events in frontend memory
and disappears when cleared or the tab reloads. There is no raw audio recording.

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

Each connection owns a `SoundNotificationFilter`. Every category result is
checked using the window's end time as `audio_time` (seconds since capture
began). Scores below the configured threshold or within a category cooldown
produce no alert. Accepted results are sent as the filter branch's `sound_event`
JSON: `id`, `category`, `subtype`, `label`, `score`, `audio_time`, `severity`, and
`type`. This is the current integration payload, rather than the future
UTC/source/raw-class contract described in CLAUDE.md. The frontend records local
receipt time for display; it is not the precise time the sound occurred.

Thresholds are 0.3 for barking and 0.5 for siren/doorbell/horn, with 5-second cooldowns for siren/doorbell/horn,
and 10 seconds for barking. A continuous sound can alert again when its cooldown
expires; occurrence grouping is not implemented. YAMNet speech results remain
diagnostic only; the frontend creates speech sessions from Deepgram transcripts.
Browser/system notifications and lock-screen Web Push are not included.

The wrapper reads the model's 521-class label map rather than hardcoding score
indexes. Embeddings and spectrograms are unused. Notification settings live in
`app/events/sound_notifications.py`; category mapping stays in `app/audio/yamnet.py`.
The siren subtype score/margin rules are provisional diagnostic choices.

## Deepgram captions

Add `DEEPGRAM_API_KEY` to your backend `.env`, then restart the server. Never put
the permanent key in frontend environment variables. `POST /deepgram/token`
returns a short-lived token with `Cache-Control: no-store`; the browser uses that
token to connect directly to Deepgram. FastAPI does not proxy transcription audio.
The key needs permission to mint Deepgram tokens. For deployment, set
`SOUNDSIGHT_ALLOWED_ORIGINS` to the exact frontend HTTPS origin and protect the
token endpoint against unauthorized use; the current route has no authentication
or rate limit, and CORS is not authentication.

The browser sends the same mono 16 kHz PCM frames to `/ws/listen` and Deepgram.
Transcription doesn't wait for YAMNet speech detection. Missing credentials or a
Deepgram failure leave environmental streaming active and show captions as
unavailable. Stop and restart listening to retry the failed transcription service.
