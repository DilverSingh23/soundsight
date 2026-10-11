/**
 * Pure reducer for Deepgram streaming Results messages. Interim text is always
 * provisional; only `is_final` results become persistent captions. Keeping
 * speech_final boundaries separately avoids losing final chunks when the
 * recognizer finalizes a long sentence in multiple parts.
 */

export type DeepgramTranscript = {
  /** Complete utterances ended by `speech_final`. */
  completedUtterances: readonly string[];
  /** Immutable final segments in the current unfinished utterance. */
  currentFinalSegments: readonly string[];
  /** Latest provisional words, replaced rather than appended. */
  interimText: string;
  /** Millisecond start offsets of processed final segments, for deduplication. */
  seenFinalStartsMs: readonly number[];
};

const MAX_TRACKED_SEGMENTS = 512;

export function emptyDeepgramTranscript(): DeepgramTranscript {
  return {
    completedUtterances: [],
    currentFinalSegments: [],
    interimText: "",
    seenFinalStartsMs: [],
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Ignore Deepgram Metadata, SpeechStarted, and malformed/unsupported messages. */
export function applyDeepgramMessage(
  previous: DeepgramTranscript,
  incoming: unknown,
): DeepgramTranscript {
  const message = asRecord(incoming);
  if (!message || message.type !== "Results" || typeof message.is_final !== "boolean") {
    return previous;
  }

  const channel = asRecord(message.channel);
  const alternatives = channel?.alternatives;
  if (!Array.isArray(alternatives) || alternatives.length === 0) return previous;
  const alternative = asRecord(alternatives[0]);
  if (!alternative || typeof alternative.transcript !== "string") return previous;

  const text = alternative.transcript.trim();
  if (!message.is_final) {
    // Every new interim message replaces its predecessor (including empty ones).
    if (previous.interimText === text) return previous;
    return { ...previous, interimText: text };
  }

  // Repeated final messages at the same audio offset should not duplicate text.
  // Never dedupe by wording: people can genuinely say the same words twice.
  const start = message.start;
  const startMs = typeof start === "number" && Number.isFinite(start) && start >= 0
    ? Math.round(start * 1000)
    : null;
  const duplicate = startMs !== null && previous.seenFinalStartsMs.includes(startMs);
  const addSegment = text.length > 0 && !duplicate;
  const currentFinalSegments = addSegment
    ? [...previous.currentFinalSegments, text]
    : previous.currentFinalSegments;
  const seenFinalStartsMs = addSegment && startMs !== null
    ? [...previous.seenFinalStartsMs, startMs].slice(-MAX_TRACKED_SEGMENTS)
    : previous.seenFinalStartsMs;

  if (message.speech_final === true && currentFinalSegments.length > 0) {
    const utterance = currentFinalSegments.join(" ");
    return {
      completedUtterances: [...previous.completedUtterances, utterance],
      currentFinalSegments: [],
      interimText: "",
      seenFinalStartsMs,
    };
  }

  if (!addSegment && previous.interimText === "") return previous;
  return { ...previous, currentFinalSegments, interimText: "", seenFinalStartsMs };
}

/** Everything confirmed by Deepgram, including chunks in the active utterance. */
export function getFinalTranscript(transcript: DeepgramTranscript): string {
  return [...transcript.completedUtterances, ...transcript.currentFinalSegments].join(" ");
}

/** Finalized text plus the current interim candidate, for a responsive UI. */
export function getVisibleTranscript(transcript: DeepgramTranscript): string {
  return [getFinalTranscript(transcript), transcript.interimText].filter(Boolean).join(" ");
}
