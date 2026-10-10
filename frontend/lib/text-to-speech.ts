const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

type Callbacks = {
  onStart: () => void;
  onEnd: () => void;
  onError: (message: string) => void;
};

// Requests ElevenLabs audio for `text` from the backend and plays it. Returns a
// stop function immediately so Stop also works during the fetch/decode wait.
export function speakWithElevenLabs(text: string, speed: number, { onStart, onEnd, onError }: Callbacks): () => void {
  const controller = new AbortController();
  let audio: HTMLAudioElement | undefined;
  let objectUrl: string | undefined;
  let stopped = false;

  function cleanup() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = undefined;
  }

  function stop() {
    stopped = true;
    controller.abort();
    if (audio) {
      audio.onended = audio.onerror = null;
      audio.pause();
    }
    cleanup();
  }

  async function run() {
    let response: Response;
    try {
      response = await fetch(`${backendUrl}/tts/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, speed }),
        signal: controller.signal,
      });
    } catch {
      if (!stopped) onError("Could not reach the backend for voice playback.");
      return;
    }
    if (stopped) return;

    if (!response.ok) {
      onError(`Backend voice playback failed (status ${response.status}).`);
      return;
    }

    const blob = await response.blob();
    if (stopped) return;

    objectUrl = URL.createObjectURL(blob);
    audio = new Audio(objectUrl);
    audio.onended = () => {
      cleanup();
      onEnd();
    };
    audio.onerror = () => {
      cleanup();
      onError("Voice audio failed to play.");
    };

    try {
      await audio.play();
      if (stopped) return;
      onStart();
    } catch {
      if (!stopped) onError("Voice audio failed to play.");
    }
  }

  void run();
  return stop;
}
