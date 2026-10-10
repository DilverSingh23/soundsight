import { WebVoiceProcessor } from "@picovoice/web-voice-processor";

// Picovoice shares one recorder. Serialize sessions, including late permission
// grants, so cleanup from an old session cannot stop a newly started session.
let previousReleased: Promise<void> = Promise.resolve();

export async function startCapture(onFrame: (frame: Int16Array) => void): Promise<() => Promise<void>> {
  const previous = previousReleased;
  let release!: () => void;
  previousReleased = new Promise<void>((resolve) => { release = resolve; });
  await previous;

  const engine = {
    onmessage(event: MessageEvent<{ command: string; inputFrame: Int16Array }>) {
      if (event.data.command === "process") onFrame(event.data.inputFrame);
    },
  };
  let ended = false;
  async function stop() {
    if (ended) return;
    ended = true;
    try {
      await WebVoiceProcessor.unsubscribe(engine);
      const context = WebVoiceProcessor.audioContext;
      if (context && context.state !== "closed") await context.close();
    } finally {
      release();
    }
  }

  try {
    WebVoiceProcessor.setOptions({ outputSampleRate: 16000, frameLength: 1600 });
    await WebVoiceProcessor.subscribe(engine);
    return stop;
  } catch (error) {
    await stop();
    throw error;
  }
}
