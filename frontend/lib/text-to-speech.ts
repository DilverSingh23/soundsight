import { backendAccessHeaders } from "./backend-access.ts";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
export const VOICE_REQUEST_TIMEOUT_MS = 15_000;

type Callbacks = {
  onStart: () => void;
  onEnd: () => void;
  onError: (message: string) => void;
};

// Cleanup is returned immediately, including while fetching or decoding audio.
export function speakWithElevenLabs(text: string, speed: number, { onStart, onEnd, onError }: Callbacks): () => void {
  const controller = new AbortController();
  let audio: HTMLAudioElement | undefined;
  let objectUrl: string | undefined;
  let stopped = false;
  let settled = false;

  function cleanup() {
    clearTimeout(timeout);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = undefined;
  }

  function stop() {
    stopped = true;
    controller.abort();
    if (audio) {
      audio.onended = audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    cleanup();
  }

  function fail(message: string) {
    if (stopped || settled) return;
    settled = true;
    stop();
    onError(message);
  }

  async function run() {
    try {
      if (window.location?.protocol === "https:" && !backendUrl.startsWith("https://")) {
        fail("Voice playback requires an HTTPS backend on secure pages.");
        return;
      }
      const response = await fetch(`${backendUrl.replace(/\/$/, "")}/tts/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...backendAccessHeaders() },
        body: JSON.stringify({ text, speed }),
        signal: controller.signal,
      });
      if (stopped) return;
      if (!response.ok) {
        fail(response.status === 401 ? "Enter your demo access code in Settings." : `Backend voice playback failed (status ${response.status}).`);
        return;
      }
      const blob = await response.blob();
      if (stopped) return;
      if (blob.size === 0) {
        fail("Voice playback returned no audio.");
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      audio = new Audio(objectUrl);
      audio.onended = () => {
        if (stopped || settled) return;
        settled = true;
        cleanup();
        onEnd();
      };
      audio.onerror = () => fail("Voice audio failed to play.");
      await audio.play();
      if (stopped || settled) return;
      clearTimeout(timeout);
      onStart();
    } catch {
      fail("Could not download or play the voice audio.");
    }
  }

  const timeout = setTimeout(() => fail("Voice playback timed out. Try the device voice."), VOICE_REQUEST_TIMEOUT_MS);
  void run();
  return stop;
}
