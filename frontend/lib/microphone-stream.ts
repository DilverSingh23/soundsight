export type ListeningStatus = "Stopped" | "Requesting permission" | "Connecting" | "Listening" | "Finishing" | "Error";
export type AudioStats = { chunks: number; bytes: number; duration_seconds: number; rms: number; peak: number };

export type Classification = {
  window_start: number;
  window_end: number;
  inference_ms: number;
  results: { category: string; subtype: string; score: number; raw_class: string }[];
};
export type ClassificationStatus = { state: "disabled" | "ready" | "error"; message: string };
export type SoundEvent = {
  type: "sound_event";
  id: string;
  category: "siren" | "doorbell" | "dog" | "horn";
  subtype: string;
  label: string;
  score: number;
  audio_time: number;
  severity: "critical" | "important" | "ambient";
};

export type MicrophoneStreamCallbacks = {
  onStatus: (status: ListeningStatus, message: string) => void;
  onStats: (stats: AudioStats) => void;
  onClassification?: (result: Classification) => void;
  onClassificationStatus?: (status: ClassificationStatus) => void;
  onSoundEvent?: (event: SoundEvent) => void;
  beforeCapture?: () => Promise<void>;
  onAudio?: (audio: ArrayBuffer) => void;
};

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "ws://localhost:8000/ws/listen";

type CaptureModule = { startCapture: (onFrame: (frame: Int16Array) => void) => Promise<() => Promise<void>> };
const loadCapture = (): Promise<CaptureModule> => import("./picovoice-capture");

export function encodePCMFrame(frame: Int16Array): ArrayBuffer {
  const bytes = new ArrayBuffer(frame.length * 2);
  const view = new DataView(bytes);
  for (let i = 0; i < frame.length; i++) view.setInt16(i * 2, frame[i], true);
  return bytes;
}

// Returns cleanup immediately so Stop also works during permission/setup awaits.
export function startMicrophoneStream({ onStatus, onStats, onClassification, onClassificationStatus, onSoundEvent, beforeCapture, onAudio }: MicrophoneStreamCallbacks, getCapture: () => Promise<CaptureModule> = loadCapture): () => void {
  let stopped = false;
  let stopCapture: (() => Promise<void>) | undefined;
  let socket: WebSocket | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setInterval> | undefined;
  let lastStats = Date.now();

  function stop() {
    stopped = true;
    clearTimeout(timeout);
    clearInterval(watchdog);
    if (stopCapture) void stopCapture().catch(() => {});
    if (socket) {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
    }
  }

  function fail(message: string) {
    if (stopped) return;
    stop();
    onStatus("Error", message);
  }

  async function prepareCapture() {
    if (stopped || !socket) return;
    const capture = await getCapture();
    if (stopped) return;
    clearTimeout(timeout);
    await beforeCapture?.();
    if (stopped) return;
    onStatus("Requesting permission", "Allow microphone access to begin. You can cancel with Stop Listening.");
    clearTimeout(timeout); // Permission dialogs can stay open until the user responds.
    const currentSocket = socket;
    const cleanup = await capture.startCapture((frame) => {
      if (stopped) return;
      if (currentSocket.readyState !== WebSocket.OPEN) {
        fail("Backend disconnected. Listening has stopped.");
        return;
      }
      if (currentSocket.bufferedAmount > 64000) {
        fail("Connection is too slow. Listening stopped; please reconnect.");
        return;
      }
      try {
        const audio = encodePCMFrame(frame);
        currentSocket.send(audio);
        onAudio?.(audio);
      } catch {
        fail("Could not send audio. Listening stopped.");
      }
    });
    if (stopped) {
      await cleanup(); // Release a microphone granted after Stop was pressed.
      return;
    }
    stopCapture = cleanup;
    onStatus("Listening", "Microphone audio is streaming to the backend.");
    lastStats = Date.now();
    watchdog = setInterval(() => {
      if (Date.now() - lastStats > 10000) fail("No audio acknowledgment from the backend. Listening stopped.");
    }, 1000);
  }

  async function start() {
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) {
        fail("Microphone streaming requires a supported browser on localhost or HTTPS.");
        return;
      }
      onStatus("Connecting", "Connecting to the backend…");
      socket = new WebSocket(backendUrl);
      timeout = setTimeout(() => fail("Backend did not respond. Check that it is running."), 10000);
      socket.onopen = () => {
        socket?.send(JSON.stringify({ type: "start", encoding: "pcm_s16le", sample_rate: 16000, channels: 1 }));
      };
      let ready = false;
      socket.onmessage = (event) => {
        if (stopped) return;
        try {
          const result = JSON.parse(event.data);
          if (result.type === "ready" && !ready) {
            ready = true;
            clearTimeout(timeout);
            // Bound library loading time; permission waiting is handled separately.
            timeout = setTimeout(() => fail("Audio setup timed out. Please try again."), 10000);
            void prepareCapture().then(() => clearTimeout(timeout)).catch((error: unknown) => {
              const name = error instanceof Error ? error.name : "";
              fail(name === "PermissionError" || name === "NotAllowedError"
                ? "Microphone permission was denied. Allow access in browser settings and try again."
                : "Could not initialize microphone audio processing. Check your microphone and try again.");
            });
          } else if (result.type === "audio_stats" && ready) {
            lastStats = Date.now();
            onStats(result);
          } else if (result.type === "classification" && ready) {
            onClassification?.(result);
          } else if (result.type === "classification_status" && ready) {
            onClassificationStatus?.(result);
          } else if (result.type === "sound_event" && ready) {
            onSoundEvent?.(result);
          } else if (result.type === "error") {
            fail(result.message ?? "The backend rejected the audio stream.");
          } else {
            fail("Unexpected backend response. Listening stopped.");
          }
        } catch {
          fail("Invalid backend response. Listening stopped.");
        }
      };
      socket.onerror = () => fail("Connection failed. Check that the backend is running.");
      socket.onclose = () => fail("Backend disconnected. Listening has stopped.");
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      fail((name === "NotAllowedError" || name === "PermissionError")
        ? "Microphone permission was denied. Allow access in your browser settings and try again."
        : (name === "NotFoundError" || name === "DeviceMissingError")
          ? "No microphone was found. Connect a microphone and try again."
          : "Could not start listening. Check your microphone and backend connection.");
    }
  }

  void start();
  return stop;
}
