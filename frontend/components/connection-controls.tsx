"use client";

import { useListening } from "@/components/listening-provider";

export default function ConnectionControls({ diagnosticsOnly = false, buttonsOnly = false }: { diagnosticsOnly?: boolean; buttonsOnly?: boolean }) {
  const { status, message, stats, active, start, stop } = useListening();
  const buttonClass = "min-h-12 rounded-lg border border-current px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <section className={buttonsOnly ? "" : "rounded-xl border border-current p-6"} aria-label="Listening controls">
      {!buttonsOnly && <div role="status" aria-live="polite">
        <p className="font-semibold">Status: {status}</p>
        {message && <p className="mt-2">{message}</p>}
      </div>}
      {!diagnosticsOnly && <div className="mt-6 flex flex-wrap gap-3">
        <button className={buttonClass} onClick={start} disabled={active}>Start Listening</button>
        <button className={buttonClass} onClick={stop} disabled={!active}>Stop Listening</button>
      </div>}
      {!buttonsOnly && stats && (
        <div className="mt-6 space-y-2">
          <p>Backend received: {stats.chunks} chunks · {stats.bytes.toLocaleString()} bytes · {stats.duration_seconds.toFixed(1)} seconds</p>
          <label className="block" htmlFor="audio-level">Audio level received by backend</label>
          <meter id="audio-level" className="h-6 w-full" min={0} max={1} value={stats.rms} />
          <p>RMS: {stats.rms.toFixed(4)} · Peak: {stats.peak.toFixed(4)}</p>
        </div>
      )}
      {!buttonsOnly && <p className="mt-6 text-sm">Audio is sent to the SoundSight backend while listening and is not saved. Keep this app open and active. Captions and sound recognition are coming next.</p>}
    </section>
  );
}
