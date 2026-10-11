# soundsight
An assistive audio-awareness prototype with live captions, sound estimates, and type-to-speak.

## Running it locally

**Prerequisites:**
- Python 3.13 (for TensorFlow compatibility)
- Node.js 22.18+ or 24+

### 1. Backend

From `backend/`:

```bash
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Runs at `http://localhost:8000`. `GET /health` returns `{"status":"ok"}`; API docs are at `/docs`.

To enable type-to-speak audio output, copy `backend/.env.example` to `backend/.env`
and fill in a real `ELEVENLABS_API_KEY`.

See `backend/README.md` for WebSocket protocol details and how to run backend tests.

### 2. Frontend

From `frontend/`, in a second terminal:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. It defaults to `ws://localhost:8000/ws/listen`; override
with `NEXT_PUBLIC_BACKEND_WS_URL` in `frontend/.env.local` if needed (see `frontend/.env.example`).

See `frontend/README.md` for manual test checklists and how to run frontend tests.

### 3. Try it

Click **Start Listening** and allow microphone access. The backend's chunk/byte
counters should increase even in silence. RMS/peak readings should rise with sound
and fall when quiet; those levels confirm a signal reaches FastAPI.

Note: microphone access requires `localhost` or HTTPS. A plain HTTP LAN address
(e.g. testing from a phone against your laptop's local IP) will not work.

## Current state

One browser microphone streams to FastAPI/YAMNet for environmental sound estimates
and Deepgram for live captions. In-app sound/speech banners, session transcripts,
and ElevenLabs type-to-speak with a device voice fallback are connected.

The frontend includes Home Screen installation metadata and icons. Listening requires
an open, active app and connectivity. Lock-screen push, the separate Mac/Pi receiver,
and offline operation are not implemented. This prototype does not replace certified
safety-alerting equipment.

See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment preparation and phone acceptance
checks; these files do not deploy anything. See `CLAUDE.md` for the proposed future
architecture and project constraints; its remote-receiver architecture is not the
current shared-browser-microphone implementation.
