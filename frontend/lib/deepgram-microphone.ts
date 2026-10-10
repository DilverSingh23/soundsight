/**
 * Bridges Dilver's existing Picovoice capture to an authenticated Deepgram
 * client. This owns ONE microphone subscription; no second recorder or
 * transcription proxy through FastAPI is required.
 *
 * The caller owns the DeepgramClient and should stop this session whenever
 * that client reports an unexpected disconnect. UI wiring comes next commit.
 */
import type { DeepgramClient } from "./deepgram";

export type DeepgramMicrophoneStatus =
  | "connecting"
  | "requesting-permission"
  | "listening"
  | "stopped"
  | "error";

export type DeepgramMicrophoneCallbacks = {
  onStatus: (status: DeepgramMicrophoneStatus, message: string) => void;
};

type DeepgramTransport = Pick<DeepgramClient, "connect" | "sendAudio" | "disconnect">;
type Capture = (onFrame: (frame: Int16Array) => void) => Promise<() => Promise<void>>;

function encodePCM(frame: Int16Array): ArrayBuffer {
  const bytes = new ArrayBuffer(frame.length * 2);
  const view = new DataView(bytes);
  for (let i = 0; i < frame.length; i++) view.setInt16(i * 2, frame[i], true);
  return bytes;
}

const defaultCapture: Capture = async (onFrame) => {
  // Lazy loading avoids requesting microphone capabilities during SSR/tests.
  const { startCapture } = await import("./picovoice-capture");
  return startCapture(onFrame);
};

function captureErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionError") {
    return "Microphone access was denied. Allow access in browser settings and retry.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No microphone was found on this device.";
  }
  return "Could not start microphone capture. Check microphone permissions and try again.";
}

/**
 * Connect to Deepgram BEFORE subscribing to the microphone to avoid losing
 * the first words. Stop is safe during auth, connection, and permission prompts.
 * No frames are buffered or dropped silently: a slow/failed transport ends the
 * session with an actionable error.
 *
 * `capture` is injectable to test the integration without microphone hardware
 * or live Deepgram credits.
 */
export function startDeepgramMicrophone(
  transport: DeepgramTransport,
  callbacks: DeepgramMicrophoneCallbacks,
  capture: Capture = defaultCapture,
): () => void {
  let active = true;
  let releaseMicrophone: (() => Promise<void>) | null = null;

  function release(): void {
    transport.disconnect();
    const releaseCapture = releaseMicrophone;
    releaseMicrophone = null;
    if (releaseCapture) void releaseCapture().catch(() => {});
  }

  function fail(message: string): void {
    if (!active) return;
    active = false;
    // Notify the owner before disconnecting; otherwise the socket close
    // callback can hide the microphone permission / audio delivery error.
    callbacks.onStatus("error", message);
    release();
  }

  function stop(): void {
    if (!active) return;
    active = false;
    release();
    callbacks.onStatus("stopped", "Microphone released and Deepgram disconnected.");
  }

  async function start(): Promise<void> {
    callbacks.onStatus("connecting", "Connecting to Deepgram before microphone capture…");
    try {
      await transport.connect();
      if (!active) return;
    } catch {
      fail("Could not connect to Deepgram. Check the backend and network.");
      return;
    }

    callbacks.onStatus("requesting-permission", "Allow microphone access to start live captions.");
    try {
      const cleanup = await capture((frame) => {
        if (!active) return;
        try {
          transport.sendAudio(encodePCM(frame));
        } catch {
          fail("Audio could not reach Deepgram. Listening stopped to avoid missing words.");
        }
      });
      if (!active) {
        // Permission could have been granted after Stop was pressed.
        await cleanup();
        return;
      }
      releaseMicrophone = cleanup;
      callbacks.onStatus("listening", "Microphone audio is streaming to Deepgram.");
    } catch (error) {
      fail(captureErrorMessage(error));
    }
  }

  void start();
  return stop;
}
