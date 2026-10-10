"use client";

import { useListening } from "@/components/listening-provider";
import AlertIcon from "./alert-icon";
import SeverityBadge from "@/components/ui/severity-badge";

export default function LiveSoundEvents({ limit = 100 }: { limit?: number }) {
  const { soundEvents, clearSoundEvents } = useListening();
  return (
    <section className="mt-5 rounded-2xl border border-current/20 p-4" aria-label="Recognized sound history">
      <h2 className="text-base font-semibold">Recognized sounds</h2>
      <p className="mt-1 text-xs opacity-80">Model estimates from listening. History stays in this tab until cleared or reloaded.</p>
      {soundEvents.length === 0 ? <p className="mt-3 text-sm">No sound alerts yet. Start listening to receive alerts.</p> : (
        <ol className="mt-3 space-y-3">
          {soundEvents.slice(0, limit).map((event) => (
            <li key={event.id} className="flex gap-3">
              <AlertIcon kind={event.category} />
              <div>
                <p className="font-semibold">{event.label}</p>
                <p className="text-xs opacity-80">Received {new Date(event.receivedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · Model score {event.score.toFixed(2)}</p>
                <SeverityBadge severity={event.severity} className="mt-1" />
              </div>
            </li>
          ))}
        </ol>
      )}
      {soundEvents.length > 0 && <button type="button" onClick={clearSoundEvents} className="mt-3 min-h-11 text-sm underline">Clear recognized sounds</button>}
    </section>
  );
}
