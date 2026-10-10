# Changelog

One section per PR. Keep each entry short: what was added, what's still missing. No verification/testing detail — that belongs in the PR description.

## PR #2 — Alfred

### Added
- `POST /tts/speak` endpoint (`backend/app/tts.py`): text in, ElevenLabs audio out, key stays server-side.
- `backend/app/config.py` for ElevenLabs env vars; `backend/.env.example` documenting them.
- `elevenlabs` SDK dependency.
- `.gitignore` (root and `backend/`) tightened to catch any `.env.*` variant, not just `.env`.

### Not done yet
- Real ElevenLabs credentials.
- Frontend call site for type-to-speak (with `window.speechSynthesis` fallback).
- Lint/typecheck tooling for `backend/` (none configured yet).
