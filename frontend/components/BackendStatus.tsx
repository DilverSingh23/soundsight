"use client";

import { useEffect, useState } from "react";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

export default function BackendStatus() {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8000/ws/listen");

    socket.onopen = () => {
      setStatus("connecting");

      // Test communication with FastAPI
      socket.send(JSON.stringify({ type: "ping" }));
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === "pong") {
          setStatus("connected");
        }
      } catch {
        setStatus("disconnected");
      }
    };

    socket.onerror = () => {
      setStatus("disconnected");
    };

    socket.onclose = () => {
      setStatus("disconnected");
    };

    return () => {
      socket.close();
    };
  }, []);

  return (
    <div className="mb-4 rounded-xl border p-4">
      <h2 className="font-semibold">Backend Connection</h2>

      <p className="mt-1 text-sm">
        Status:{" "}
        <span
          className={
            status === "connected"
              ? "font-semibold text-green-600"
              : "font-semibold text-orange-600"
          }
        >
          {status}
        </span>
      </p>
    </div>
  );
}
