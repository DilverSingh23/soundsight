"use client";

import { useEffect, useRef, useState } from "react";

type Status = "Disconnected" | "Connecting" | "Connected" | "Error";
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "ws://localhost:8000/ws/listen";

export default function ConnectionControls() {
  const socketRef = useRef<WebSocket | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState<Status>("Disconnected");
  const [message, setMessage] = useState("");

  function releaseSocket() {
    cleanupRef.current?.();
    cleanupRef.current = null;
    socketRef.current = null;
  }

  useEffect(() => () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    socketRef.current = null;
  }, []);

  function connect() {
    if (socketRef.current) return;
    setStatus("Connecting");
    setMessage("");
    let socket: WebSocket;
    try {
      socket = new WebSocket(backendUrl);
    } catch {
      setStatus("Error");
      setMessage("Could not connect. Check the backend connection address.");
      return;
    }
    socketRef.current = socket;

    function fail(reason: string) {
      if (socketRef.current !== socket) return;
      releaseSocket();
      setStatus("Error");
      setMessage(reason);
    }

    const timer = setTimeout(() => {
      fail("The backend did not respond. Check that it is running and reconnect.");
    }, 10000);

    cleanupRef.current = () => {
      clearTimeout(timer);
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
    };

    socket.onopen = () => {
      if (socketRef.current !== socket) return;
      setStatus("Connected");
      setMessage("Waiting for backend acknowledgment…");
      socket.send(JSON.stringify({ type: "ping" }));
    };
    socket.onmessage = (event) => {
      if (socketRef.current !== socket) return;
      try {
        const result = JSON.parse(event.data);
        if (result?.type !== "pong") {
          fail("The backend returned an unexpected response.");
          return;
        }
        clearTimeout(timer);
        setMessage("Backend acknowledged the connection (pong).");
      } catch {
        fail("The backend returned an invalid response.");
      }
    };
    socket.onerror = () => fail("Connection failed. Check that the backend is running and reconnect.");
    socket.onclose = () => {
      if (socketRef.current !== socket) return;
      releaseSocket();
      setStatus("Disconnected");
      setMessage("The backend connection closed. You can reconnect.");
    };
  }

  function disconnect() {
    releaseSocket();
    setStatus("Disconnected");
    setMessage("");
  }

  const active = status === "Connecting" || status === "Connected";
  const buttonClass = "min-h-12 rounded-lg border border-current px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <section className="rounded-xl border border-current p-6" aria-label="Backend connection">
      <div role="status" aria-live="polite">
        <p className="font-semibold">Status: {status}</p>
        {message && <p className="mt-2">{message}</p>}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button className={buttonClass} onClick={connect} disabled={active}>Connect</button>
        <button className={buttonClass} onClick={disconnect} disabled={!active}>Disconnect</button>
      </div>
    </section>
  );
}
