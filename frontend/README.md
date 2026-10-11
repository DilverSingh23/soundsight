This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Run commands below from `frontend/`. Start the FastAPI backend in another terminal
using the instructions in `../backend/README.md`.

The connection page defaults to `ws://localhost:8000/ws/listen`. To override it,
copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_BACKEND_WS_URL`. Restart
the development server after changing it. For deployment, set the public URL
before building; an HTTPS frontend needs a `wss://` backend URL. This variable
contains a public address, never an API key.

Click **Start Listening**, allow microphone access, and wait for **Listening**.
The backend's chunk and byte counts should increase; RMS and peak readings should
rise when speaking and fall when quiet. Counts alone only prove data delivery.
Click **Stop Listening** and confirm the browser microphone indicator turns off
and counters stop. Repeat Start/Stop, deny permission, stop the backend while
listening, and cancel while permission is pending (any late granted stream must
be released). Microphone access needs localhost or HTTPS; plain HTTP over a LAN
address does not qualify. No raw audio is persisted by this app. While configured
and connected, microphone audio also goes to Deepgram for transcription.

Audio capture uses `@picovoice/web-voice-processor` to produce mono 16 kHz
signed 16-bit samples in 1600-sample (100 ms) frames. The frontend serializes
these as little-endian PCM and sends them over WebSocket. The library owns its
AudioWorklet and resampler; there is no custom worklet asset to maintain.
Its standard microphone constraints are used, so browser/device audio processing
settings may differ. Test environmental sounds on the intended demo devices.
This implementation targets an open, active browser tab.

## Combined listening and conversations

Set `DEEPGRAM_API_KEY` in `backend/.env`, not in Next.js. The public backend HTTP
address is `NEXT_PUBLIC_BACKEND_HTTP_URL` (default `http://localhost:8000`), while
`NEXT_PUBLIC_BACKEND_WS_URL` configures environmental streaming. An HTTPS frontend
needs HTTPS and WSS backend addresses and a matching allowed origin on FastAPI.

Start Listening on Home or Captions opens one Picovoice capture session, after
the backend and Deepgram connection attempt. Each encoded frame is sent to both
destinations. Captions and sound detection continue across client-side navigation;
the root `ListeningProvider` owns their lifecycle. Opening Captions never requests
a second microphone or clears previously captured words.

Non-empty Deepgram Results create a conversation and one in-app speech banner.
Interim words replace earlier interim words; final segments are retained without
duplicating repeated results. The opening preview updates until the first final
segment, then stays fixed while the full transcript grows. Provider utterance
boundaries don't end a conversation: a gap of five audio seconds without recognized
speech closes it. Word timings are used when available; result duration is the
fallback. This is a heuristic, not speaker identification or guaranteed speech
detection. Different speakers can share a conversation.

Click Read conversation or select a history entry to open
`/captions?conversation=<id>`. Conversations stay in memory (at most 50) across
listening sessions, until cleared while stopped or the tab reloads. No database
or raw audio storage is added. Stop releases capture and the backend socket
immediately, then waits up to 2.5 seconds for Deepgram to finalize trailing words.
An app unmount terminates immediately. Deepgram failure leaves sound detection
running; diagnostics show its status, and Stop/Start retries with a fresh token.

Manual check: start on Home, speak before opening Captions, verify those words
are already present, navigate away and back, speak through a short pause, then
wait over five seconds and speak again. The latter should create a new conversation.
Test Stop during permission/setup and during speech, plus missing-key/network
failure. Capturing in a locked/background browser and OS push are not supported.

## Run and verify

From `frontend/`:

```bash
npm ci
npm run dev
npm run lint
npm run build
```

Open `http://localhost:3000`. Production builds were checked with the Webpack fallback
(`npm run build -- --webpack`) because this environment's Turbopack build could not
bind its helper port. The default build command is unchanged.

## Home Screen installation and access

The manifest and app icons support standalone installation from an HTTPS origin.
Settings includes iPhone/Android installation instructions and a demo access-code input.
Production backends require a code; local development defaults to no code. Codes stay
in sessionStorage for the current tab, with an in-memory fallback if storage is blocked.
No API keys are placed in the frontend. See `../DEPLOYMENT.md` for configuration.

There is no offline cache or service worker yet. Push/lock-screen notifications require
the future remote receiver and push integration. Listening explicitly stops on hidden,
pagehide, or offline events; it never restarts without a user action. App navigation
continues listening while the app remains visible.

Settings notification/category switches control in-app banners; history and captions
continue to update. Speech banners are suppressed on Captions. Voice requests time out
after 15 seconds, including downloading the response body, and failures trigger the
existing device voice fallback. Test playback and microphone permission on actual phones.

## Audio pipeline tests

With Node.js 22.18+ or 24+, run from `frontend/`:

```bash
node --test tests/*.test.mjs
```

These tests check PCM byte serialization and microphone lifecycle using
simulated browser resources. Real microphone permission, browser resampling, and
audio quality still require the manual checks above.

## Shared listening across screens

Start/Stop Listening is on the home monitoring card. The root layout owns one
ListeningProvider, so navigating with the app links keeps the same microphone
session running. Other screens show microphone status and a Stop Listening
button while active. Audio reception diagnostics on Home use the same session.

Manual integration check: start listening, confirm received audio counts, navigate
to Captions and Alerts, and return Home. Counts should continue without resetting.
Stop from another screen and confirm the browser microphone indicator turns off.
Repeat Start/Stop and stop FastAPI while on Captions to check error handling.
A full reload or closing/backgrounding the app ends the browser session. Live captions
and recognized sound history are connected; demo sound cards are labeled separately.
