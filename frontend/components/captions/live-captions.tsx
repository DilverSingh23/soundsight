"use client";

import { useEffect, useState } from "react";
import { useListening } from "@/components/listening-provider";
import Waveform from "./waveform";
import { updateSoundSightPreferences, useSoundSightPreferences } from "@/lib/preferences";

type PreviewState = "playing" | "paused" | "stopped";
import type { TranscriptTextSize } from "@/lib/preferences";

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

function ControlIcon({ type }: { type: "pause" | "play" | "stop" }) {
  return (
    <svg
      aria-hidden="true"
      width="17"
      height="17"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {type === "pause" && (
        <>
          <rect x="4.5" y="3.5" width="3.5" height="13" rx="1" />
          <rect x="12" y="3.5" width="3.5" height="13" rx="1" />
        </>
      )}
      {type === "play" && <path d="m6 3.5 10 6.5L6 16.5z" />}
      {type === "stop" && (
        <rect x="4.5" y="4.5" width="11" height="11" rx="2" fill="currentColor" stroke="none" />
      )}
    </svg>
  );
}

/** The visual sample is local-only. Deepgram and microphone capture are added later. */
export default function LiveCaptions() {
  const { status } = useListening();
  const [preview, setPreview] = useState<PreviewState>("playing");
  const [elapsedSeconds, setElapsedSeconds] = useState(24);
  const { textSize } = useSoundSightPreferences();

  useEffect(() => {
    if (preview !== "playing") return;
    const interval = window.setInterval(() => {
      setElapsedSeconds((previous) => previous + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [preview]);

  const statusLabel =
    preview === "playing" ? "Sample playing" : preview === "paused" ? "Sample paused" : "Sample stopped";
  const sizeIndex = TEXT_SIZE_ORDER.indexOf(textSize);

  function changeSize(direction: -1 | 1) {
    const next = TEXT_SIZE_ORDER[sizeIndex + direction];
    if (next) updateSoundSightPreferences({ textSize: next });
  }

  function resetPreview() {
    setElapsedSeconds(24);
    setPreview("playing");
  }

  return (
    <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-caption px-5 pb-8 pt-[max(2.75rem,env(safe-area-inset-top))] text-light-on-dark">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-36 right-[-120px] h-[400px] w-[400px] rounded-full bg-[#33336a]/35 blur-[110px]"
      />
      <div className="relative z-10 flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-4">
          <h1 className="font-display text-[36px] leading-tight tracking-[-0.035em]">
            Live Captions
          </h1>
          <details className="relative">
            <summary
              aria-label="Caption preview options"
              className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-full text-xl text-[#c1bedf] hover:bg-white/10 [&::-webkit-details-marker]:hidden"
            >
              <span aria-hidden="true">···</span>
            </summary>
            <div className="absolute right-0 top-full z-20 w-48 rounded-2xl border border-white/15 bg-[#303057] p-2 shadow-xl">
              <button
                type="button"
                onClick={resetPreview}
                className="min-h-11 w-full rounded-xl px-3 text-left text-sm hover:bg-white/10"
              >
                Restart sample preview
              </button>
            </div>
          </details>
        </header>

        <div className="mt-5 flex items-center justify-between gap-2 text-[11px] text-[#c2bfdc]">
          <div className="flex items-center gap-2" role="status" aria-live="polite">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${
                preview === "playing" ? "bg-[#81dec4]" : "bg-[#aaa1cb]"
              }`}
            />
            <span className="font-semibold text-[#a9e5d6]">{statusLabel}</span>
            <span aria-hidden="true">·</span>
            <span>English</span>
          </div>
          <span className="font-mono tabular-nums">{formatDuration(elapsedSeconds)}</span>
        </div>

        <div className="mt-7">
          <Waveform playing={preview === "playing"} />
        </div>

        <div className="mt-6 flex items-center gap-2 text-[10px] font-semibold tracking-[0.13em] text-[#a9b8ff]">
          <span className="h-3 w-[2px] rounded-full bg-[#82a2ff]" />
          SAMPLE TRANSCRIPT
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[#b8b3d6]">
          {status === "Listening"
            ? "Sample transcript — microphone audio is streaming, but live transcription is not connected yet."
            : status === "Stopped" || status === "Error"
              ? "Sample transcript — microphone streaming is off. No speech is being transcribed."
              : "Sample transcript — microphone setup is in progress. No speech is being transcribed."}
        </p>

        <section
          aria-label="Example speech transcript"
          className={`mt-4 space-y-7 font-medium tracking-[-0.024em] ${FONT_SIZES[textSize]}`}
        >
          <p>There’s an emergency vehicle coming down the street.</p>
          <p>Let’s wait here until it passes.</p>
          <p className="text-[#a5a0c6]">Then we can cross…</p>
        </section>

        <div className="min-h-7 flex-1" />

        <div className="rounded-[14px] bg-white/[0.075] px-3 py-1.5">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              aria-label="Decrease transcript text size"
              disabled={sizeIndex === 0}
              onClick={() => changeSize(-1)}
              className="min-h-11 min-w-11 rounded-lg text-sm font-medium disabled:opacity-30"
            >
              A−
            </button>
            <span className="text-center text-[11px] text-[#c5c0e0]">
              Text size · {textSize}
            </span>
            <button
              type="button"
              aria-label="Increase transcript text size"
              disabled={sizeIndex === TEXT_SIZE_ORDER.length - 1}
              onClick={() => changeSize(1)}
              className="min-h-11 min-w-11 rounded-lg text-lg font-medium disabled:opacity-30"
            >
              A+
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
          {preview === "stopped" ? (
            <button
              type="button"
              onClick={resetPreview}
              className="flex min-h-[54px] items-center justify-center gap-2 rounded-[15px] bg-[#ebe6fa] px-4 font-semibold text-[#252044] hover:bg-white"
            >
              <ControlIcon type="play" />
              Replay sample
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPreview(preview === "playing" ? "paused" : "playing")}
              className="flex min-h-[54px] items-center justify-center gap-2 rounded-[15px] bg-[#ebe6fa] px-4 font-semibold text-[#252044] hover:bg-white"
            >
              <ControlIcon type={preview === "playing" ? "pause" : "play"} />
              {preview === "playing" ? "Pause" : "Resume"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setPreview("stopped")}
            disabled={preview === "stopped"}
            className="flex min-h-[54px] items-center justify-center gap-2 rounded-[15px] border border-[#715084] px-4 font-semibold text-[#ff8aa1] hover:bg-white/5 disabled:opacity-45"
          >
            <ControlIcon type="stop" />
            Stop
          </button>
        </div>
      </div>
    </main>
  );
}
