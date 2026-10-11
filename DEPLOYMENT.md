# SoundSight deployment preparation

Nothing is deployed by these files. The current MVP uses one active browser microphone
for environmental classification and captions. The remote Mac/Pi receiver and Web Push
architecture in CLAUDE.md are future work; installing the PWA does not implement them.

## Vercel Hobby + Render Free demo

The repository includes `render.yaml` with an explicit `plan: free` and
`frontend/vercel.json` with the previously verified webpack build command.
These files prepare deployment; they do not create hosted services.

1. Push the reviewed app and deployment files to a GitHub branch. Do not upload
   `.env`, `.env.local`, virtual environments, or model files.
2. Import the repository in Vercel on Hobby, selecting `frontend` as Root Directory.
   Record the assigned stable production HTTPS origin, without a trailing slash.
   The initial frontend needs the backend variables below before it is usable.
3. In Render, create a Blueprint from the same repository and branch using
   `render.yaml`. Confirm the backend compute plan says **Free**.
   Set both `FRONTEND_ORIGIN` and `SOUNDSIGHT_ALLOWED_ORIGINS` to the exact Vercel
   production origin. Enter the provider keys privately in Render.
4. Render generates `SOUNDSIGHT_ACCESS_CODE`. Copy it privately from the service's
   environment settings for testers; they enter it in SoundSight Settings.
5. After the backend deploys, verify its `/health` endpoint. In Vercel's production
   environment variables, set `NEXT_PUBLIC_BACKEND_URL` and
   `NEXT_PUBLIC_BACKEND_HTTP_URL` to the backend HTTPS origin, and
   `NEXT_PUBLIC_BACKEND_WS_URL` to `wss://<backend-host>/ws/listen`.
   Redeploy the frontend after setting these public build-time variables.
6. Complete the phone acceptance checks below, including actual classification
   readiness. `/health` alone does not prove that YAMNet loaded successfully.

Render Free has 512 MB RAM and fractional CPU. Full TensorFlow/YAMNet performance
must be checked on the hosted Linux instance; a local Mac measurement does not
establish that it fits. Do not upgrade to a paid plan without explicitly choosing
that cost. The free backend sleeps after 15 idle minutes and usually takes about
a minute to wake up, plus model startup. Open `/health` and wait before listening
after an idle period. No paid resources are specified by the Blueprint.

Vercel Hobby is for personal, non-commercial use. Both hosts have free usage
limits; external Deepgram and ElevenLabs usage is billed under their own plans.
Use Render without a payment method to have relevant usage overages suspend
service/builds instead of billing. See the providers' current terms:
https://render.com/docs/free and https://vercel.com/docs/plans/hobby.

## Backend

Use a persistent host with HTTPS, WebSocket support, and enough memory for full TensorFlow.
The backend is not a Vercel serverless function. Keep one worker for the hackathon demo:
each worker loads its own model and has its own request budget.

The Docker build context is `backend/`. The Dockerfile uses Python 3.13, installs
requirements, downloads the official public YAMNet model at build time, and runs
Uvicorn as a non-root user. It accepts the hosting platform's `PORT` (default 8000).
The Docker image has not been built or tested on a Linux host yet.

Set server environment variables using the hosting platform's secret settings:

```dotenv
SOUNDSIGHT_ENV=production
SOUNDSIGHT_ACCESS_CODE=<a-random-private-demo-code>
FRONTEND_ORIGIN=https://your-frontend.example
SOUNDSIGHT_ALLOWED_ORIGINS=https://your-frontend.example
DEEPGRAM_API_KEY=<private-key>
ELEVENLABS_API_KEY=<private-key>
ELEVENLABS_VOICE_ID=<your-voice-id>
ELEVENLABS_MODEL_ID=eleven_flash_v2_5
YAMNET_MODEL_DIR=/app/.models/yamnet
```

Generate the access code privately with `python -c 'import secrets; print(secrets.token_hex(32))'`.
Share it only with demo testers, who enter it in SoundSight Settings. Do not put it in
`NEXT_PUBLIC_` variables, a URL, a commit, or logs. It is saved in sessionStorage for that
tab (memory fallback if storage is blocked). Production startup rejects missing/invalid
codes and non-HTTPS frontend origins. Replace BOTH origin settings; the development
list includes localhost by default. Use exact origins without paths or trailing slashes.

HTTP provider routes require `Authorization: Bearer <code>`. Browser audio WebSockets
use the `soundsight` and `access.<code>` subprotocols; the server selects only `soundsight`.
Browser WebSocket Origins are checked separately. Configure any reverse proxy not to
log Authorization or Sec-WebSocket-Protocol headers. These credentials require HTTPS/WSS.
Local development permits an empty access code.

A shared in-memory budget allows 30 TTS/token requests per minute per process and returns
429 with Retry-After when exhausted. This is a limited private demo gate, not accounts,
per-user quotas, or production authentication. Rotate the code if shared accidentally;
restart the backend and disconnect existing sessions when revoking access. Set provider
spend limits too: a minted Deepgram token can establish a long-running paid stream.

Health endpoint: `/health`. It reports the API process is up; check the app's YAMNet
status separately to verify model readiness. Allow startup time for model loading/warmup.
Keep WebSocket proxy idle timeouts compatible with listening sessions. Never enable
access logs that capture audio, transcripts, typed messages, credentials, or provider tokens.

## Frontend

Set the project root to `frontend/`, install with `npm ci`, build with `npm run build`,
and use the hosting platform's Next.js integration. Public environment values must be
set BEFORE building; changing them requires rebuilding:

```dotenv
NEXT_PUBLIC_BACKEND_URL=https://your-backend.example
NEXT_PUBLIC_BACKEND_HTTP_URL=https://your-backend.example
NEXT_PUBLIC_BACKEND_WS_URL=wss://your-backend.example/ws/listen
```

The first HTTP URL is used by ElevenLabs playback; the second by Deepgram token requests.
Both should point to the same backend. HTTPS pages cannot use HTTP/WS backend addresses.
The production build was verified locally using `npm run build -- --webpack`; Docker
and hosted builds still need verification. The build downloads the configured Google fonts.

The manifest, 192/512 px icons, maskable icon, Apple touch icon, viewport safe areas,
and standalone metadata are included. Settings explains Home Screen installation.
There is no service worker or offline cache: this real-time MVP needs connectivity.
A service worker can be added with the future push integration rather than caching
captions, microphone audio, or credentials.

## Phone acceptance checks after deployment

1. Open the HTTPS address in Safari/Chrome; enter the demo code in Settings.
2. Install through Safari Share → Add to Home Screen, or Android Install app.
3. Open the installed app; verify its icon, standalone window, readable text, and navigation.
4. Start listening and grant microphone permission; verify received audio levels.
5. Trigger a doorbell/bark/siren/horn. Check a real in-app alert and history entry.
   Diagnostic scores show the threshold and remaining cooldown for each category.
6. Speak on Home, open the speech banner, and verify earlier words are in the transcript.
   Short pauses extend the same conversation; a five-second gap creates a new one.
7. Navigate between pages while listening; sound alerts continue. Speech banners are
   suppressed on Captions, where the transcript is already visible.
8. Test notification/category preferences. These control banners, not classification or history.
9. Test TTS audio and Stop while downloading; if provider playback fails or takes over
   15 seconds, the device voice fallback is attempted. Test actual iOS playback: browsers
   may restrict delayed playback after a network request. Device voice settings apply to
   the fallback; the configured ElevenLabs voice is selected on the backend.
10. Stop listening; confirm the microphone indicator turns off and counters stop.
11. Background/lock the phone or disconnect networking: listening stops when the browser
    delivers the corresponding lifecycle event. Return and explicitly restart; no automatic
    background microphone promise is made.
12. Try missing/wrong code, denied microphone permission, and a backend disconnect;
    confirm useful status and recovery through Settings or Start Listening.

No lock-screen notifications are implemented. Completing that feature requires the
separate receiver, VAPID keys, push subscription storage, a service worker, backend
push delivery, and tests on an installed iPhone PWA.

## Sound latency and repeat frequency

Windows cover 0.975 seconds with 0.48-second hops. Alerts emit on the first qualifying
window; there is no deliberate multi-second wait before the first detection.
Thresholds remain dog 0.3, others 0.5. Cooldowns remain dog 10 seconds, others 5 seconds.
A weak/short clip can fall below threshold for several windows or be missed. Browser
microphone processing can affect the signal. Use diagnostics on the actual phone before
changing thresholds; lower thresholds increase false alerts. Inference time alone is not
the full capture-to-display latency. Cooldowns suppress repeats, not the first alert.
