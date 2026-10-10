"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useListening } from "@/components/listening-provider";
import SeverityBadge from "@/components/ui/severity-badge";

export default function SoundEventBanner() {
  const { latestNotification: latest } = useListening();
  const latestId = latest?.id;
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  useEffect(() => {
    if (!latestId) return;
    const timer = setTimeout(() => setDismissedId(latestId), 8000);
    return () => clearTimeout(timer);
  }, [latestId]);
  const visible = latest && latest.id !== dismissedId;
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {visible && <div className="mx-4 my-3 rounded-2xl border border-current/30 bg-surface p-4 text-foreground">
        <div className="flex items-start justify-between gap-3">
          <div><p className="font-semibold">{latest.label}</p><SeverityBadge severity={latest.severity} className="mt-1" /></div>
          <button type="button" onClick={() => setDismissedId(latest.id)} className="min-h-11 px-2 text-sm underline">Dismiss</button>
        </div>
        {latest.type === "speech_event" && <p className="mt-2 text-sm">{latest.preview}</p>}
        <Link href={latest.type === "speech_event" ? `/captions?conversation=${latest.sessionId}` : "/alerts"} className="inline-flex min-h-11 items-center text-sm underline">{latest.type === "speech_event" ? "Read conversation" : "View recognized sounds"}</Link>
      </div>}
    </div>
  );
}
