"use client";

import { useState } from "react";
import AlertIcon, { type SoundKind } from "@/components/alerts/alert-icon";
import SeverityBadge, {
  type SoundSeverity,
} from "@/components/ui/severity-badge";

// The backend will eventually supply real SoundEvent objects. Until then, this
// list is explicitly sample data; no microphone or detection is running here.
type AlertItem = {
  id: string;
  kind: SoundKind;
  label: string;
  message: string;
  severity: SoundSeverity;
  time: string;
};

type AlertFilter = "all" | SoundSeverity;
type DemoSound = Pick<AlertItem, "kind" | "label" | "message" | "severity">;

const demoSounds: readonly DemoSound[] = [
  {
    kind: "siren",
    label: "Siren detected",
    message: "An emergency vehicle is nearby.",
    severity: "critical",
  },
  {
    kind: "doorbell",
    label: "Doorbell",
    message: "Someone may be at your door.",
    severity: "important",
  },
  {
    kind: "speech",
    label: "Speech nearby",
    message: "A person is speaking close to you.",
    severity: "important",
  },
  {
    kind: "dog",
    label: "Dog barking",
    message: "A dog is barking in the distance.",
    severity: "ambient",
  },
  {
    kind: "horn",
    label: "Car horn",
    message: "A vehicle sounded its horn nearby.",
    severity: "important",
  },
];

// Fixed display times make the sample feed deterministic during SSR/hydration.
const sampleTimes = ["9:41 AM", "9:38 AM", "9:36 AM", "9:32 AM", "9:28 AM"];
const sampleAlerts: AlertItem[] = demoSounds.map((sound, index) => ({
  ...sound,
  id: `sample-${index}`,
  time: sampleTimes[index],
}));

const filters: readonly { value: AlertFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "important", label: "Important" },
  { value: "ambient", label: "Ambient" },
];

const iconColors: Record<SoundSeverity, string> = {
  critical: "bg-[#ffe5eb] text-[#e85670]",
  important: "bg-[#eee6fe] text-[#8b5ce0]",
  ambient: "bg-[#eeebf5] text-[#777594]",
};

export default function SoundAlerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>(sampleAlerts);
  const [filter, setFilter] = useState<AlertFilter>("all");
  const [nextSound, setNextSound] = useState(0);

  const visibleAlerts =
    filter === "all"
      ? alerts
      : alerts.filter((alert) => alert.severity === filter);

  function simulateSound() {
    const sound = demoSounds[nextSound];
    const newAlert: AlertItem = {
      ...sound,
      id: crypto.randomUUID(),
      time: new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
    };
    setAlerts((previous) => [newAlert, ...previous]);
    setNextSound((previous) => (previous + 1) % demoSounds.length);
    // Newly simulated sounds should always be visible, even after filtering.
    setFilter("all");
  }

  return (
    <section aria-label="Environmental sound alerts" className="flex flex-1 flex-col">
      <header
        className="relative overflow-hidden px-6 pb-8 pt-11"
        style={{ backgroundImage: "var(--gradient-alerts)" }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-14 -top-20 h-64 w-64 rounded-full bg-white/40 blur-3xl"
        />
        <div className="relative">
          <h1 className="font-display text-[37px] leading-tight tracking-[-0.035em] text-foreground">
            Your soundscape
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            A clearer picture of what&apos;s around you.
          </p>

          <div
            aria-label="Filter by alert severity"
            className="mt-7 flex flex-wrap gap-2"
            role="group"
          >
            {filters.map(({ value, label }) => {
              const selected = filter === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFilter(value)}
                  className={[
                    "min-h-11 rounded-full px-4 text-[12px] font-medium transition-colors",
                    selected
                      ? "bg-[#211c3e] text-white shadow-sm"
                      : "bg-white/55 text-[#3e365b] hover:bg-white/85",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col px-5 pb-9 pt-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Sample activity
            </p>
            <p className="mt-1 text-[11px] text-muted" aria-live="polite">
              {visibleAlerts.length} of {alerts.length} sounds
            </p>
          </div>
          <button
            type="button"
            onClick={simulateSound}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand-soft px-3.5 text-xs font-semibold text-brand-deep transition-colors hover:bg-[#dfd2f7]"
          >
            <span aria-hidden="true" className="text-base leading-none">+</span>
            Simulate sound
          </button>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Demo preview only. Real sound detection is not connected yet.
        </p>

        {visibleAlerts.length > 0 ? (
          <ol className="mt-3 divide-y divide-outline" aria-label="Sound alert history">
            {visibleAlerts.map((alert) => (
              <li key={alert.id}>
                <article className="flex gap-3 py-4">
                  <div
                    className={[
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px]",
                      iconColors[alert.severity],
                    ].join(" ")}
                  >
                    <AlertIcon kind={alert.kind} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="min-w-0 text-[14px] font-semibold leading-5 text-foreground">
                        {alert.label}
                      </h2>
                      <time className="shrink-0 pt-1 text-[10px] text-muted">
                        {alert.time}
                      </time>
                    </div>
                    <p className="mt-0.5 text-xs leading-[1.45] text-muted">
                      {alert.message}
                    </p>
                    <SeverityBadge
                      severity={alert.severity}
                      className="mt-1.5 text-[10px]"
                    />
                  </div>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <div
            role="status"
            className="mt-6 rounded-2xl border border-outline bg-surface px-5 py-9 text-center"
          >
            <h2 className="font-display text-xl text-foreground">
              {alerts.length === 0 ? "All clear" : "Nothing in this category"}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {alerts.length === 0
                ? "Your sample alerts were cleared. Simulate a sound to add one."
                : "Try another filter to see the other sounds."}
            </p>
            {alerts.length > 0 && (
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="mt-3 min-h-11 px-4 text-sm font-medium text-brand-deep underline underline-offset-4"
              >
                Show all sounds
              </button>
            )}
          </div>
        )}

        {alerts.length > 0 && (
          <button
            type="button"
            onClick={() => setAlerts([])}
            className="mt-5 self-center min-h-11 rounded-full px-4 text-xs font-medium text-muted underline underline-offset-4 hover:text-foreground"
          >
            Clear sample alerts
          </button>
        )}
      </div>
    </section>
  );
}
