# CLAUDE.md

## 1. What we are building

SoundSight makes environmental sound visible for Deaf and hard-of-hearing users.

**Demo goal (this is the thing that must work):**
`MacBook or Raspberry Pi mic -> FastAPI -> YAMNet -> Web Push -> notification on a locked iPhone Lock Screen.`

Three user-facing surfaces, all in one installable PWA:
1. **Environmental sound alerts.** Remote mic detects a priority sound, phone gets a push notification.
2. **Live captions.** Phone mic streams to Deepgram, transcript renders in real time.
3. **Type-to-speak.** User types, ElevenLabs speaks it aloud so hearing people can respond naturally.

**Why the mic is not on the phone:** browsers suspend JavaScript when the screen locks or the tab is backgrounded, so a phone cannot listen in the background. Moving capture to a MacBook or Pi and delivering alerts over Web Push routes around that entirely. This is a deliberate architectural decision, not a limitation. Do not propose moving environmental capture into the browser.

**Non-goals:** direction of arrival (impossible without a mic array), speaker diarization (only if Deepgram gives it as a config flag with zero extra work), offline mode, auth, multi-user, a database beyond push subscriptions.

### Safety positioning
SoundSight is an assistive aid, **not a life-safety device**. Never describe it in UI, copy, or slides as a replacement for a certified smoke or fire alarm. Keep that line in onboarding and in the presentation.

---

## 2. Architecture

```
[MacBook / Pi USB mic]
   capture.py: 16 kHz mono float32, ~0.975 s windows
        |  WebSocket (wss)
        v
[FastAPI backend]
   YAMNet inference -> class map -> threshold -> cooldown
        |                                  |
        | Web Push (pywebpush/VAPID)       | WebSocket to open clients
        v                                  v
[Service worker on iPhone]          [Next.js PWA, live UI]
   Lock Screen notification

[iPhone mic] --getUserMedia--> [Deepgram streaming] --> live captions
[Text input] --> [FastAPI proxy] --> [ElevenLabs] --> audio playback
```

Two independent mic sources by design: the **remote mic** does environmental detection, the **phone mic** does live captions. They never share a stream.

---

## 3. Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js PWA, TypeScript, installable to iOS Home Screen |
| Backend | FastAPI (Python), WebSockets |
| Sound detection | YAMNet (pretrained, AudioSet ontology) |
| Speech to text | Deepgram streaming |
| Text to speech | ElevenLabs |
| Push | Web Push API + VAPID + pywebpush |
| Capture | Web Audio API (phone), Python sounddevice (MacBook/Pi) |
| Hosting | Frontend on Vercel; backend must be HTTPS/wss reachable from the phone |

---

## 4. The event contract

This is the interface three developers build against in parallel. **Agree on it before writing feature code, and do not change it unilaterally.** It lives in a shared types file and is mirrored in a Pydantic model.

```ts
type SoundEvent = {
  id: string;             // uuid, for dedupe on the client
  label: string;          // user-facing, e.g. "Doorbell"
  rawClass: string;       // YAMNet/AudioSet class that fired
  confidence: number;     // 0..1
  severity: "critical" | "important" | "ambient";
  timestamp: string;      // ISO 8601, UTC
  source: "pi" | "macbook";
};
```

Severity drives notification urgency, colour, and vibration pattern. Class to label to severity mapping lives in **one** config file on the backend, not scattered across modules.

---

## 5. Hard constraints and known gotchas

Read these before writing code in the relevant area. Each one has cost a team a demo before.

1. **iOS Web Push only works from an installed PWA.** Safari will not even show the permission prompt from a normal tab. The app must be added to the Home Screen first, on iOS 16.4+, served over HTTPS. Onboarding has to walk the user through installing.
2. **Spike push first, before building anything else.** The entire demo goal depends on a notification reaching a locked iPhone. Prove that path with a hardcoded "hello" payload in the first two hours. If it fails, we need to know on day one, not at hour 40.
3. **No API keys in the browser, ever.** Deepgram, ElevenLabs, and VAPID private keys stay server-side. The browser gets a short-lived scoped token from a FastAPI endpoint. `NEXT_PUBLIC_` on a secret is an automatic PR rejection.
4. **Mixed content kills WebSockets.** An HTTPS page cannot open a `ws://` connection. The backend needs `wss://`, via a tunnel or a deployed host. Sort this on day one, not during integration.
5. **YAMNet input format is strict:** 16 kHz, mono, float32 waveform, roughly 0.975 second frames. Resample on the capture side, not in the model wrapper.
6. **Cooldowns are not optional.** One doorbell produces many consecutive positive frames. Per-class cooldown (suggest 10 to 15 s) plus a per-class confidence threshold, both in config. A demo that fires nine notifications for one knock looks broken.
7. **Thresholds are asymmetric.** A missed smoke alarm is much worse than a spurious doorbell. Tune recall high on `critical`, precision high on `ambient`.
8. **Push latency is variable.** The path through APNs is not instant. Measure actual end-to-end latency early and state the real number in the presentation rather than claiming real time.
9. **Full TensorFlow on a Raspberry Pi is painful.** Prefer the TFLite runtime there. Keep the Pi path optional until the MacBook path works end to end.
10. **ElevenLabs latency can break conversational feel.** Use a low-latency model, and keep `window.speechSynthesis` as a one-line fallback so the type-to-speak demo never hangs.

---

## 6. How Claude should work here

**Before writing code**
- Read the existing files in the module you are touching. Do not infer contents from filenames.
- State a short plan for anything non-trivial and wait for confirmation. Do not scaffold a whole feature unprompted.
- If the request is ambiguous or this file does not answer it, **ask instead of guessing**.

**Design and library choices**
- Verify API signatures, model names, and SDK versions against current official docs before committing to them. Do not rely on memory. Deepgram, ElevenLabs, and MediaPipe/TF APIs all change, and deprecated names look plausible.
- Name the tradeoff in a sentence, including one alternative rejected and why.
- **Never invent an API, config key, or benchmark number.** Say you are unsure.

**Quality bar, hackathon-calibrated**
- Small, focused diffs. One concern per PR. Three people are working in parallel; a sprawling diff causes merge pain nobody has time for.
- **Stay in your module.** Do not refactor or reformat files owned by another developer.
- Tests only where logic breaks silently: threshold and cooldown logic, class mapping, the event contract. Skip UI tests.
- Every failure path needs defined behaviour: mic permission denied, WebSocket drop, Deepgram disconnect, model load failure, push subscription expired. A crash during the demo is the worst outcome in the project.
- Never log audio, transcripts, or push subscription endpoints.
- Run lint and typecheck before claiming done. If you did not run them, say so.

**Do not**
- Add a dependency without flagging it and saying what it replaces.
- Change the event contract, thresholds, or severity mapping as a side effect of an unrelated task.
- Report success you did not verify on a device.

---

## 7. Ownership

| Dev | Area |
|---|---|
| Dev 1 | Next.js PWA, mobile UI, live captions, Deepgram client |
| Dev 2 | FastAPI, WebSocket audio streaming, YAMNet classification, class config |
| Dev 3 | ElevenLabs TTS, Web Push and service worker, iPhone notification testing, Pi integration |

Shared and change-by-agreement only: the `SoundEvent` contract, the PWA manifest, the service worker.

---

## 8. Conventions

- TypeScript `strict: true`, no `any`. Python with type hints and Pydantic models at boundaries.
- No magic numbers. Audio constants carry units in the name: `SAMPLE_RATE_HZ`, `WINDOW_MS`, `COOLDOWN_S`.
- Conventional Commits (`feat:`, `fix:`, `chore:`). Branches `type/short-description`.
- PR body: what changed, why, how it was tested, what to look at closely.

---

## 9. Commands

> Fill in once tooling exists. Use these exact commands rather than guessing.

```bash
# frontend: install / dev / build / lint
# backend: venv / install / run
# capture script: run on MacBook / run on Pi
```

---

## 10. Scope discipline

Cut in this order if time runs short. Decide now so nobody argues at hour 40.

1. Raspberry Pi integration (MacBook mic is an equally good demo)
2. Speaker diarization
3. Polish on the type-to-speak interface
4. Any sound class beyond the core five

**Never cut:** the push path to a locked iPhone, cooldowns, error handling on the demo path, the recorded backup demo video.

**Definition of demo-ready:** a judge installs the PWA, locks the phone, someone triggers a sound across the room, and the Lock Screen lights up. Everything else is supporting cast.

---

## 11. Demo insurance

Hackathon rooms are loud and networks are hostile. Required before the last 8 hours:
- A "play test sound" button that triggers known clips, so a demo never depends on ambient noise.
- A recorded 60 second screen capture of the full flow working, captured the night before.
- A tested fallback if venue wifi blocks the WebSocket (phone hotspot).