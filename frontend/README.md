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
address does not qualify. No audio is persisted or sent to AI providers yet.

Audio capture uses `@picovoice/web-voice-processor` to produce mono 16 kHz
signed 16-bit samples in 1600-sample (100 ms) frames. The frontend serializes
these as little-endian PCM and sends them over WebSocket. The library owns its
AudioWorklet and resampler; there is no custom worklet asset to maintain.
Its standard microphone constraints are used, so browser/device audio processing
settings may differ. Test environmental sounds on the intended demo devices.
This implementation targets an open, active browser tab.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

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
A full reload or closing the app ends the browser session. Caption preview controls
operate only on sample content; live transcription and sound alerts are not wired.
