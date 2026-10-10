import { applyDeepgramMessage, emptyDeepgramTranscript, type DeepgramTranscript } from "./deepgram-transcript.ts";

export const SPEECH_PAUSE_SECONDS = 5;
export type SpeechSession = {
  id: string;
  startedAt: string;
  startAudioTime: number;
  lastSpeechAudioTime: number;
  active: boolean;
  preview: string;
  previewFinal: boolean;
  transcript: DeepgramTranscript;
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** Audio offsets group short pauses; provider utterance boundaries aren't conversations. */
export function applySpeechMessage(
  sessions: readonly SpeechSession[],
  incoming: unknown,
  createId: () => string,
  receivedAt: string,
): SpeechSession[] {
  const message = record(incoming);
  if (!message || message.type !== "Results" || typeof message.is_final !== "boolean"
    || typeof message.start !== "number" || !Number.isFinite(message.start) || message.start < 0
    || typeof message.duration !== "number" || !Number.isFinite(message.duration) || message.duration < 0) return [...sessions];

  const alternatives = record(message.channel)?.alternatives;
  const alternative = Array.isArray(alternatives) ? record(alternatives[0]) : null;
  const wordTimings = Array.isArray(alternative?.words) ? alternative.words : [];
  const firstWordStart = record(wordTimings[0])?.start;
  const lastWordEnd = record(wordTimings.at(-1))?.end;
  const start = typeof firstWordStart === "number" && Number.isFinite(firstWordStart) && firstWordStart >= message.start ? firstWordStart : message.start;
  const end = message.start + message.duration;
  // A delayed final response can still belong to an already closed session.
  const index = sessions.findIndex((session) => start >= session.startAudioTime - 0.001
    && start < session.lastSpeechAudioTime + SPEECH_PAUSE_SECONDS);
  const previous = index >= 0 ? sessions[index] : null;
  const transcript = applyDeepgramMessage(previous?.transcript ?? emptyDeepgramTranscript(), incoming);
  if (previous && transcript === previous.transcript) return [...sessions];
  const words = [...transcript.completedUtterances, ...transcript.currentFinalSegments, transcript.interimText].filter(Boolean).join(" ");
  if (!words && !previous) return [...sessions];
  const hasNewWords = typeof alternative?.transcript === "string" && Boolean(alternative.transcript.trim());
  const speechEnd = typeof lastWordEnd === "number" && Number.isFinite(lastWordEnd) && lastWordEnd >= start ? lastWordEnd : end;
  const session: SpeechSession = previous ?? {
    id: createId(), startedAt: receivedAt, startAudioTime: start,
    lastSpeechAudioTime: speechEnd, active: true, preview: "", previewFinal: false,
    transcript: emptyDeepgramTranscript(),
  };
  const updated: SpeechSession = {
    ...session, transcript,
    active: session.active || (hasNewWords && speechEnd > session.lastSpeechAudioTime),
    lastSpeechAudioTime: hasNewWords ? Math.max(session.lastSpeechAudioTime, speechEnd) : session.lastSpeechAudioTime,
    preview: session.previewFinal || !words ? session.preview : words.slice(0, 100) + (words.length > 100 ? "…" : ""),
    previewFinal: session.previewFinal || (message.is_final === true && hasNewWords),
  };
  const next = [...sessions];
  if (previous) next[index] = updated;
  else next.unshift(updated);
  return next.slice(0, 50);
}

export function expireSpeechSessions(sessions: readonly SpeechSession[], audioTime: number): SpeechSession[] {
  return sessions.map((session) => session.active && audioTime - session.lastSpeechAudioTime >= SPEECH_PAUSE_SECONDS
    ? { ...session, active: false, transcript: { ...session.transcript, interimText: "" } } : session);
}

export function closeSpeechSessions(sessions: readonly SpeechSession[]): SpeechSession[] {
  return sessions.map((session) => session.active
    ? { ...session, active: false, transcript: { ...session.transcript, interimText: "" } } : session);
}
