"use client";

import { useState } from "react";

type Severity = "critical" | "important" | "ambient";

type SoundAlert = {
  id: string;
  label: string;
  message: string;
  severity: Severity;
  timestamp: string;
};

const demoSounds = [
  {
    label: "Siren",
    message: "Emergency siren detected nearby.",
    severity: "critical",
  },
  {
    label: "Doorbell",
    message: "Someone may be at your door.",
    severity: "important",
  },
  {
    label: "Dog Barking",
    message: "Dog barking detected nearby.",
    severity: "ambient",
  },
  {
    label: "Speech",
    message: "Someone nearby is speaking.",
    severity: "important",
  },
] satisfies {
  label: string;
  message: string;
  severity: Severity;
}[];

const severityStyles = {
  critical: "border-red-300 bg-red-50",
  important: "border-amber-300 bg-amber-50",
  ambient: "border-blue-200 bg-blue-50",
};

export default function SoundAlerts() {
  const [alerts, setAlerts] = useState<SoundAlert[]>([]);
  const [nextSound, setNextSound] = useState(0);

  function simulateSound() {
    const sound = demoSounds[nextSound];

    const newAlert: SoundAlert = {
      ...sound,
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString(),
    };

    setAlerts((previous) => [newAlert, ...previous]);
    setNextSound((previous) => (previous + 1) % demoSounds.length);
  }

  function clearAlerts() {
    setAlerts([]);
  }

  return (
    <section className="mx-auto max-w-xl p-5">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">SoundSight</h1>
        <p className="mt-1 text-gray-500">Environmental Sound Monitoring</p>
      </header>

      <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
        <h2 className="font-semibold text-green-900">Demo Mode</h2>
        <p className="mt-1 text-sm text-green-800">
          Sound detection is simulated. The microphone backend is not connected
          yet.
        </p>
      </div>

      <button
        onClick={simulateSound}
        className="mb-6 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
      >
        Simulate Sound Detection
      </button>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Recent Alerts ({alerts.length})</h2>

        <button
          onClick={clearAlerts}
          className="text-sm text-blue-600 hover:underline"
        >
          Clear All
        </button>
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-xl border p-8 text-center text-gray-500">
          No alerts yet. Try simulating a sound!
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-xl border p-4 ${
                severityStyles[alert.severity]
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-gray-900">{alert.label}</h3>

                <span className="rounded-full bg-white px-2 py-1 text-xs font-medium capitalize text-gray-700">
                  {alert.severity}
                </span>
              </div>

              <p className="mt-2 text-sm text-gray-700">{alert.message}</p>

              <p className="mt-2 text-xs text-gray-500">{alert.timestamp}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
