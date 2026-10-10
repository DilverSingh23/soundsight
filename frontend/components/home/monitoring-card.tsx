"use client";

import { useEffect, useState } from "react";

type BackendStatus = "checking" | "connected" | "offline";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "ws://localhost:8000/ws/listen";

/** This checks FastAPI's ping/pong endpoint; it does NOT activate the microphone or YAMNet. */
export default function MonitoringCard() {
  const [status, setStatus] = useState<BackendStatus>("checking");

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    const timeout = setTimeout(() => {
      if (!active) return;
      setStatus("offline");
      socket?.close();
    }, 8000);

    try {
      socket = new WebSocket(BACKEND_URL);
      socket.onopen = () => socket?.send(JSON.stringify({ type: "ping" }));
      socket.onmessage = (event: MessageEvent<string>) => {
        if (!active) return;
        try {
          const response: unknown = JSON.parse(event.data);
          if (
            typeof response === "object" &&
            response !== null &&
            "type" in response &&
            response.type === "pong"
          ) {
            clearTimeout(timeout);
            setStatus("connected");
          } else {
            clearTimeout(timeout);
            setStatus("offline");
          }
        } catch {
          clearTimeout(timeout);
          setStatus("offline");
        }
      };
      socket.onerror = () => {
        if (active) setStatus("offline");
      };
      socket.onclose = () => {
        if (active) setStatus("offline");
      };
    } catch {
      clearTimeout(timeout);
      // Defer the update so it does not run synchronously inside the effect.
      queueMicrotask(() => {
        if (active) setStatus("offline");
      });
    }

    return () => {
      active = false;
      clearTimeout(timeout);
      socket?.close();
    };
  }, []);

  const heading =
    status === "connected"
      ? "Backend connected"
      : status === "checking"
        ? "Checking connection"
        : "Backend offline";

  const color =
    status === "connected"
      ? "bg-[#97ddc8]"
      : status === "checking"
        ? "bg-[#d5c3ff]"
        : "bg-[#fa8a96]";

  return (
    <section
      aria-label="SoundSight connection status"
      className="relative z-10 flex min-h-[104px] items-center gap-4 rounded-[21px] border border-[#554778] bg-[#2b2449] px-5 py-4 shadow-[0_12px_32px_rgba(8,7,24,0.24)]"
    >
      <div className="relative flex size-[62px] shrink-0 items-center justify-center" aria-hidden="true">
        <span className="absolute size-[62px] rounded-full border border-[#7d7cc2]/50" />
        <span className="absolute size-[47px] rounded-full border border-[#7d7cc2]/70" />
        <span className="absolute size-[32px] rounded-full border border-[#7d7cc2]" />
        <span className={`size-[15px] rounded-full shadow-[0_0_14px_rgba(154,217,205,0.45)] ${color}`} />
      </div>
      <div className="min-w-0" role="status" aria-live="polite">
        <h2 className="text-base font-semibold text-white">{heading}</h2>
        <p className="mt-1 text-xs leading-relaxed text-[#c1b9d7]">
          {status === "connected"
            ? "Connection ready · Sound detection not active yet"
            : status === "checking"
              ? "Checking FastAPI availability…"
              : "Start FastAPI to connect SoundSight"}
        </p>
      </div>
    </section>
  );
}
