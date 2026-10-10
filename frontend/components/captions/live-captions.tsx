"use client";

import { useSearchParams } from "next/navigation";
import { useListening } from "@/components/listening-provider";
import { emptyDeepgramTranscript } from "@/lib/deepgram-transcript";
import SpeechSessionHistory from "@/components/captions/speech-session-history";
import Waveform from "./waveform";
import { updateSoundSightPreferences, useSoundSightPreferences, type TranscriptTextSize } from "@/lib/preferences";

const FONT_SIZES: Record<TranscriptTextSize, string> = {
  small: "text-[23px] leading-[1.35]",
  regular: "text-[28px] leading-[1.34]",
  large: "text-[33px] leading-[1.28]",
};
const TEXT_SIZE_ORDER: readonly TranscriptTextSize[] = ["small", "regular", "large"];

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function ControlIcon({ type }: { type: "play" | "stop" }) {
  return (
    <svg aria-hidden="true" width="17" height="17" viewBox="0 0 20 20"
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {type === "play" && <path d="m6 3.5 10 6.5L6 16.5z" />}
      {type === "stop" && <rect x="4.5" y="4.5" width="11" height="11" rx="2" fill="currentColor" stroke="none" />}
    </svg>
  );
}

/** Captions are live only after Start Listening, never a silent sample preview. */
export default function LiveCaptions() {
  const { status, active: isActive, stats, transcriptionStatus, transcriptionMessage,
    speechSessions, start, stop, clearConversations } = useListening();
  const conversationId = useSearchParams().get("conversation");
  const selected = conversationId ? speechSessions.find((session) => session.id === conversationId) : speechSessions[0];
  const transcript = selected?.transcript ?? emptyDeepgramTranscript();
  const isListening = status === "Listening" && transcriptionStatus === "connected";
  const isStarting = status === "Connecting" || status === "Requesting permission";
  const isFinishing = status === "Finishing";
  const captionError = transcriptionStatus === "error" || (status === "Listening" && transcriptionStatus === "disconnected");
  const elapsedSeconds = stats?.duration_seconds ?? 0;
  const { textSize } = useSoundSightPreferences();
  const sizeIndex = TEXT_SIZE_ORDER.indexOf(textSize);
  const finalParts = [...transcript.completedUtterances, ...transcript.currentFinalSegments];
  const hasTranscript = finalParts.length > 0 || transcript.interimText.length > 0;

  function changeSize(direction: -1 | 1) {
    const next = TEXT_SIZE_ORDER[sizeIndex + direction];
    if (next) updateSoundSightPreferences({ textSize: next });
  }

  const statusLabel = captionError ? "Captions unavailable" : isListening ? "Listening" : isStarting ? "Starting" : isFinishing ? "Finishing" : status === "Error" ? "Error" : "Ready";
  const detail = conversationId && !selected ? "This conversation is no longer available in this tab."
    : transcriptionMessage || "Start Listening on any screen to capture speech and environmental sounds together.";

  return (
    <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-caption px-5 pb-8 pt-[max(2.75rem,env(safe-area-inset-top))] text-light-on-dark">
      <div aria-hidden="true" className="pointer-events-none absolute -top-36 right-[-120px] h-[400px] w-[400px] rounded-full bg-[#33336a]/35 blur-[110px]" />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4">
          <h1 className="font-display text-[36px] leading-tight tracking-[-0.035em]">Live Captions</h1>
          <details className="relative">
            <summary aria-label="Caption options" className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-full text-xl text-[#c1bedf] hover:bg-white/10 [&::-webkit-details-marker]:hidden">
              <span aria-hidden="true">···</span>
            </summary>
            <div className="absolute right-0 top-full z-20 w-48 rounded-2xl border border-white/15 bg-[#303057] p-2 shadow-xl">
              <button type="button" onClick={clearConversations} disabled={isActive || speechSessions.length === 0}
                className="min-h-11 w-full rounded-xl px-3 text-left text-sm hover:bg-white/10 disabled:opacity-45">
                Clear conversation history
              </button>
            </div>
          </details>
        </header>

        <div className="mt-5 flex items-center justify-between gap-2 text-[11px] text-[#c2bfdc]">
          <div className="flex items-center gap-2" role="status" aria-live="polite">
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${isListening ? "bg-[#81dec4]" : captionError || status === "Error" ? "bg-[#ff8aa1]" : "bg-[#aaa1cb]"}`} />
            <span className={`font-semibold ${captionError || status === "Error" ? "text-[#ff8aa1]" : "text-[#a9e5d6]"}`}>{statusLabel}</span>
            <span aria-hidden="true">·</span>
            <span>English</span>
          </div>
          <span className="font-mono tabular-nums">{formatDuration(elapsedSeconds)}</span>
        </div>

        <div className="mt-7"><Waveform playing={isListening} /></div>

        <div className="mt-6 flex items-center gap-2 text-[10px] font-semibold tracking-[0.13em] text-[#a9b8ff]">
          <span className="h-3 w-[2px] rounded-full bg-[#82a2ff]" />
          {selected ? (selected.active ? "LIVE CONVERSATION" : "SAVED CONVERSATION") : "LIVE TRANSCRIPT"}
        </div>
        <p className={`mt-2 text-[11px] leading-relaxed ${captionError || status === "Error" ? "text-[#ff9aaa]" : "text-[#b8b3d6]"}`} role={captionError || status === "Error" ? "alert" : "status"}>
          {detail}
        </p>

        <section aria-label="Speech transcript" aria-live="polite" aria-atomic="false"
          className={`mt-4 min-h-[155px] flex-1 space-y-5 overflow-y-auto pb-4 font-medium tracking-[-0.024em] ${FONT_SIZES[textSize]}`}>
          {finalParts.map((part, index) => (
            <p key={index}>{part}</p>
          ))}
          {transcript.interimText && (
            <p aria-live="off" className="text-[#a5a0c6]">{transcript.interimText}</p>
          )}
          {!hasTranscript && (
            <p aria-live="off" className="text-[#a5a0c6]">
              {isListening ? "Listening for speech…" : isStarting ? "Preparing the microphone…" : "Your spoken captions will appear here."}
            </p>
          )}
        </section>

        <div className="mt-3 rounded-[14px] bg-white/[0.075] px-3 py-1.5">
          <div className="flex items-center justify-between gap-3">
            <button type="button" aria-label="Decrease transcript text size" disabled={sizeIndex === 0}
              onClick={() => changeSize(-1)} className="min-h-11 min-w-11 rounded-lg text-sm font-medium disabled:opacity-30">A−</button>
            <span className="text-center text-[11px] text-[#c5c0e0]">Text size · {textSize}</span>
            <button type="button" aria-label="Increase transcript text size" disabled={sizeIndex === TEXT_SIZE_ORDER.length - 1}
              onClick={() => changeSize(1)} className="min-h-11 min-w-11 rounded-lg text-lg font-medium disabled:opacity-30">A+</button>
          </div>
        </div>

        <p className="mt-3 text-xs text-[#b8b3d6]">Captions continue while you browse other screens. Opening a conversation does not restart listening. Speech is sent to Deepgram; history stays in this tab until cleared or reloaded.</p>
        <SpeechSessionHistory />
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
          <button type="button" onClick={start} disabled={isActive}
            className="flex min-h-[54px] items-center justify-center gap-2 rounded-[15px] bg-[#ebe6fa] px-4 font-semibold text-[#252044] hover:bg-white disabled:opacity-45">
            <ControlIcon type="play" />
            {isListening ? "Listening" : isStarting ? "Starting…" : isFinishing ? "Finishing…" : "Start Listening"}
          </button>
          <button type="button" onClick={stop} disabled={!isActive || isFinishing}
            className="flex min-h-[54px] items-center justify-center gap-2 rounded-[15px] border border-[#715084] px-4 font-semibold text-[#ff8aa1] hover:bg-white/5 disabled:opacity-45">
            <ControlIcon type="stop" />Stop
          </button>
        </div>
      </div>
    </main>
  );
}
