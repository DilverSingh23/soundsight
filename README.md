# soundsight
All in one digital hearing aid.

## Running it locally

**Prerequisites:**
- Python 3 (for the backend virtual environment)
- Node.js 22.18+ or 24+

### 1. Backend

From `backend/`:

```bash
python3 -m venv .venv
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
counters and RMS/peak readings should rise when you speak and fall when quiet —
that confirms audio is flowing from the browser to FastAPI.

Note: microphone access requires `localhost` or HTTPS. A plain HTTP LAN address
(e.g. testing from a phone against your laptop's local IP) will not work.

## Current state

Mic capture → FastAPI WebSocket → live audio stats is working end to end. YAMNet
sound classification, Deepgram live captions, and Web Push notifications are not
wired up yet. The `alerts`, `captions`, `speak`, and `settings` pages exist as UI;
captions/alerts currently show sample content only.

See `CLAUDE.md` for the full architecture, event contract, and project constraints.
