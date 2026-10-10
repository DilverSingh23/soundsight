/** One capture feeds the environmental backend and Deepgram in parallel. */
import type { DeepgramClient, DeepgramClientCallbacks } from "./deepgram";
import type { MicrophoneStreamCallbacks } from "./microphone-stream";

type Transport = Pick<DeepgramClient, "connect" | "sendAudio" | "disconnect" | "finish">;
type CaptureFactory = (callbacks: MicrophoneStreamCallbacks) => () => void;
export type SharedListeningCallbacks = MicrophoneStreamCallbacks & {
  onTranscriptionStatus: DeepgramClientCallbacks["onStatus"];
  onTranscript: DeepgramClientCallbacks["onMessage"];
  onEnded: () => void;
};

export function startLiveCaptionsSession(
  callbacks: SharedListeningCallbacks,
  createTransport: (callbacks: DeepgramClientCallbacks) => Transport,
  startMicrophone: CaptureFactory,
): (graceful?: boolean) => void {
  let active = true;
  let finishing = false;
  let recording = false;
  let transcriptionReady = false;
  let stopCapture: (() => void) | null = null;
  const transport = createTransport({
    onStatus(status, message) {
      if (!active) return;
      transcriptionReady = status === "connected";
      callbacks.onTranscriptionStatus(status, message);
    },
    onMessage(message) {
      if (active) callbacks.onTranscript(message);
    },
  });

  function releaseCapture() {
    const cleanup = stopCapture;
    stopCapture = null;
    cleanup?.();
  }

  function end() {
    if (!active) return;
    active = false;
    releaseCapture();
    transport.disconnect();
    callbacks.onEnded();
  }

  stopCapture = startMicrophone({
    ...callbacks,
    onStatus(status, message) {
      if (!active || finishing) return;
      recording = status === "Listening";
      if (status === "Error") end();
      callbacks.onStatus(status, message);
    },
    async beforeCapture() {
      // Connect before producing audio so the first captured words aren't lost.
      // An unavailable transcription provider must not disable sound awareness.
      try {
        await transport.connect();
      } catch {
        transcriptionReady = false;
      }
    },
    onAudio(audio) {
      if (!active || finishing) return;
      callbacks.onAudio?.(audio);
      if (!transcriptionReady) return;
      try {
        transport.sendAudio(audio);
      } catch {
        transcriptionReady = false;
        transport.disconnect();
        callbacks.onTranscriptionStatus("error", "Captions stopped: audio could not reach Deepgram. Sound detection remains active. Stop and restart listening to retry.");
      }
    },
  });
  if (!active) releaseCapture();

  return (graceful = false) => {
    if (!active) return;
    if (finishing) {
      if (!graceful) end();
      return;
    }
    releaseCapture(); // Release microphone and backend socket immediately.
    if (!graceful || !recording || !transcriptionReady) {
      end();
      callbacks.onStatus("Stopped", "Microphone released and connections closed.");
      return;
    }
    finishing = true;
    callbacks.onStatus("Finishing", "Microphone released. Finishing the last caption words…");
    void transport.finish().then(() => {
      if (!active) return;
      end();
      callbacks.onStatus("Stopped", "Microphone released and connections closed.");
    }).catch(() => {
      if (!active) return;
      end();
      callbacks.onStatus("Stopped", "Microphone released; final caption words may be incomplete.");
    });
  };
}
