/**
 * Owns one Deepgram connection and one microphone subscription as a unit.
 * No browser APIs or credentials are accessed directly here, so lifecycle
 * failures can be tested with fake transports and capture functions.
 */
import type { DeepgramClient, DeepgramClientCallbacks, DeepgramConnectionStatus } from "./deepgram";
import type { DeepgramMicrophoneCallbacks, DeepgramMicrophoneStatus } from "./deepgram-microphone";

type Transport = Pick<DeepgramClient, "connect" | "sendAudio" | "disconnect" | "finish">;
type TransportFactory = (callbacks: DeepgramClientCallbacks) => Transport;
type MicrophoneFactory = (transport: Transport, callbacks: DeepgramMicrophoneCallbacks) => (keepConnectionOpen?: boolean) => void;

export type LiveCaptionsSessionCallbacks = {
  onConnectionStatus: (status: DeepgramConnectionStatus, message: string) => void;
  onMicrophoneStatus: (status: DeepgramMicrophoneStatus, message: string) => void;
  onMessage: (message: unknown) => void;
  onEnded?: () => void;
};

/**
 * Closing the socket automatically stops capture. After any failure a fresh
 * call creates a fresh client/token; late callbacks from the old session are
 * ignored. Calling the returned stop function repeatedly is safe.
 */
export function startLiveCaptionsSession(
  callbacks: LiveCaptionsSessionCallbacks,
  createTransport: TransportFactory,
  startMicrophone: MicrophoneFactory,
): (graceful?: boolean) => void {
  let active = true;
  let recording = false;
  let finishing = false;
  let stopMicrophone: ((keepConnectionOpen?: boolean) => void) | null = null;
  const transport = createTransport({
    onStatus(status, message) {
      if (!active) return;
      if (status === "error" || status === "disconnected") {
        end();
        callbacks.onConnectionStatus(status, message);
        callbacks.onMicrophoneStatus(
          status === "error" ? "error" : "stopped",
          status === "error"
            ? "Speech recognition connection failed. Please try again."
            : "Speech recognition disconnected. The microphone was stopped.",
        );
      } else {
        callbacks.onConnectionStatus(status, message);
      }
    },
    onMessage(message) {
      if (active) callbacks.onMessage(message);
    },
  });

  function end() {
    if (!active) return;
    active = false; // Suppress synchronous disconnect callbacks before cleanup.
    if (stopMicrophone) stopMicrophone();
    // The capture may already have stopped for graceful finalization.
    // Still close the socket when the page unmounts during that wait.
    if (finishing || !stopMicrophone) transport.disconnect();
    callbacks.onEnded?.();
  }

  const stop = startMicrophone(transport, {
    onStatus(status, message) {
      if (!active) return;
      if (finishing && status === "stopped") return;
      recording = status === "listening";
      if (status === "error") {
        end();
        callbacks.onMicrophoneStatus("error", message);
        callbacks.onConnectionStatus("disconnected", "Deepgram session stopped.");
      } else {
        callbacks.onMicrophoneStatus(status, message);
      }
    },
  });
  stopMicrophone = stop;
  if (!active) stop(); // Handles synchronous setup failure.

  return (graceful = false) => {
    if (!active) return;
    // An unmount during finalization must still terminate immediately.
    if (finishing) {
      if (!graceful) end();
      return;
    }
    // Route unmount and stops during connection/permissions remain immediate.
    if (!graceful || !recording) {
      end();
      callbacks.onMicrophoneStatus("stopped", "Microphone released and Deepgram disconnected.");
      callbacks.onConnectionStatus("disconnected", "Deepgram session stopped.");
      return;
    }

    finishing = true;
    // Stop producing audio, but preserve the WebSocket for final Results.
    stopMicrophone?.(true);
    callbacks.onMicrophoneStatus("finishing", "Finishing the last words…");
    void transport.finish().then(() => {
      if (!active) return;
      end();
      callbacks.onMicrophoneStatus("stopped", "Microphone released and Deepgram disconnected.");
      callbacks.onConnectionStatus("disconnected", "Deepgram session stopped.");
    }).catch(() => {
      if (!active) return;
      end();
      callbacks.onMicrophoneStatus("error", "Could not finalize the last words.");
      callbacks.onConnectionStatus("disconnected", "Deepgram session stopped.");
    });
  };
}
