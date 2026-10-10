"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useListening } from "@/components/listening-provider";
import SeverityBadge from "@/components/ui/severity-badge";

export default function SoundEventBanner() {
  const { soundEvents } = useListening();
  const latest = soundEvents[0];
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  useEffect(() => {
    if (!latest) return;
    const timer = setTimeout(() => setDismissedId(latest.id), 8000);
    return () => clearTimeout(timer);
  }, [latest]);
  const visible = latest && latest.id !== dismissedId;
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {visible && <div className="mx-4 my-3 rounded-2xl border border-current/30 bg-surface p-4 text-foreground">
        <div className="flex items-start justify-between gap-3">
          <div><p className="font-semibold">{latest.label}</p><SeverityBadge severity={latest.severity} className="mt-1" /></div>
          <button type="button" onClick={() => setDismissedId(latest.id)} className="min-h-11 px-2 text-sm underline">Dismiss</button>
        </div>
        <Link href="/alerts" className="inline-flex min-h-11 items-center text-sm underline">View recognized sounds</Link>
      </div>}
    </div>
  );
}
