"use client";

import { useListening } from "@/components/listening-provider";
import ConnectionControls from "@/components/connection-controls";

export default function MonitoringCard() {
  const { status, message, active } = useListening();
  const heading = status === "Stopped" ? "Ready to listen" : status;
  const color = status === "Listening" ? "bg-[#97ddc8]" : status === "Error" ? "bg-[#fa8a96]" : "bg-[#d5c3ff]";

  return (
    <section
      aria-label="SoundSight listening status"
      className="relative z-10 min-h-[104px] rounded-[21px] border border-[#554778] bg-[#2b2449] px-5 py-4 shadow-[0_12px_32px_rgba(8,7,24,0.24)]"
    >
      <div className="flex items-center gap-4">
        <div className="relative flex size-[62px] shrink-0 items-center justify-center" aria-hidden="true">
          <span className="absolute size-[62px] rounded-full border border-[#7d7cc2]/50" />
          <span className="absolute size-[47px] rounded-full border border-[#7d7cc2]/70" />
          <span className="absolute size-[32px] rounded-full border border-[#7d7cc2]" />
          <span className={`size-[15px] rounded-full shadow-[0_0_14px_rgba(154,217,205,0.45)] ${color}`} />
        </div>
        <div className="min-w-0" role="status" aria-live="polite">
          <h2 className="text-base font-semibold text-white">{heading}</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#c1b9d7]">
            {message || "Start listening to stream microphone audio."}
          </p>
        </div>
      </div>
      <ConnectionControls buttonsOnly />
      {active && <p className="mt-3 text-xs text-[#c1b9d7]">Listening continues across screens. Captions and sound detection are not connected yet.</p>}
    </section>
  );
}
