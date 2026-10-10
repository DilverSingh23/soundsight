"use client";

import Link from "next/link";
import { useListening } from "@/components/listening-provider";

export default function SpeechSessionHistory() {
  const { speechSessions } = useListening();
  return (
    <section aria-label="Conversation history" className="mt-5 rounded-2xl border border-current/20 p-4">
      <h2 className="text-base font-semibold">Conversations</h2>
      {speechSessions.length === 0 ? <p className="mt-2 text-sm">Recognized speech will appear here while listening.</p> : (
        <ol className="mt-2 space-y-2">
          {speechSessions.map((session) => (
            <li key={session.id}>
              <Link className="block min-h-11 rounded-lg py-2 text-sm underline" href={`/captions?conversation=${session.id}`}>
                {session.preview || "Conversation"}
                <span className="mt-1 block text-xs no-underline opacity-80">{session.active ? "Active" : "Ended"} · {new Date(session.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
