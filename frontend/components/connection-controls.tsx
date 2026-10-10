"use client";

import { useEffect, useRef, useState } from "react";
import { startMicrophoneStream, type AudioStats, type ListeningStatus } from "@/lib/microphone-stream";

export default function ConnectionControls() {
  const cleanupRef = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState<ListeningStatus>("Stopped");
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState<AudioStats | null>(null);

  useEffect(() => () => { cleanupRef.current?.(); }, []);

  function start() {
    cleanupRef.current?.();
    setStats(null);
    cleanupRef.current = startMicrophoneStream({ onStatus: (next, detail) => {
      setStatus(next);
      setMessage(detail);
    }, onStats: setStats });
  }

  function stop() {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setStatus("Stopped");
    setMessage("Microphone released and connection closed.");
  }

  const active = status !== "Stopped" && status !== "Error";
  const buttonClass = "min-h-12 rounded-lg border border-current px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <section className="rounded-xl border border-current p-6" aria-label="Listening controls">
      <div role="status" aria-live="polite">
        <p className="font-semibold">Status: {status}</p>
        {message && <p className="mt-2">{message}</p>}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button className={buttonClass} onClick={start} disabled={active}>Start Listening</button>
        <button className={buttonClass} onClick={stop} disabled={!active}>Stop Listening</button>
      </div>
      {stats && (
        <div className="mt-6 space-y-2">
          <p>Backend received: {stats.chunks} chunks · {stats.bytes.toLocaleString()} bytes · {stats.duration_seconds.toFixed(1)} seconds</p>
          <label className="block" htmlFor="audio-level">Audio level received by backend</label>
          <meter id="audio-level" className="h-6 w-full" min={0} max={1} value={stats.rms} />
          <p>RMS: {stats.rms.toFixed(4)} · Peak: {stats.peak.toFixed(4)}</p>
        </div>
      )}
      <p className="mt-6 text-sm">Audio is sent to the SoundSight backend while listening and is not saved. Keep this app open and active. Captions and sound recognition are coming next.</p>
    </section>
  );
}
