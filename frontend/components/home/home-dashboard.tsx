import Link from "next/link";
import ConnectionControls from "@/components/connection-controls";
import NavigationIcon from "@/components/navigation/navigation-icon";
import MonitoringCard from "./monitoring-card";
import Nightscape from "./nightscape";

function SoundWaveIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width="25"
      height="25"
      viewBox="0 0 25 25"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    >
      <path d="M2 10v5m4-9v13m4-17v21m4-15v9m4-12v15m4-11v5" />
    </svg>
  );
}

function SirenIcon() {
  return (
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 17v-5a6 6 0 0 1 12 0v5M4 20h16M12 1v2M4 5l2 2M20 5l-2 2M1 12h2M21 12h2" />
    </svg>
  );
}

const previewActivity = [
  { label: "Siren detected", detail: "Critical · Sample alert", time: "9:41 AM", critical: true },
  { label: "Doorbell", detail: "Important · Sample alert", time: "9:38 AM", critical: false },
] as const;

export default function HomeDashboard() {
  return (
    <main className="flex flex-1 flex-col bg-plum text-light-on-dark">
      <section className="relative min-h-[258px] overflow-hidden bg-[radial-gradient(ellipse_at_65%_25%,#3a305f_0%,#242044_52%,#16132d_100%)]">
        <Nightscape />
        <div className="relative z-10 px-6 pt-[max(2.75rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2 text-base font-semibold tracking-[-0.03em]">
            <SoundWaveIcon className="text-[#e7dbff]" />
            <span>SoundSight</span>
          </div>
          <h1 className="mt-8 max-w-[350px] font-display text-[clamp(29px,8vw,37px)] leading-[1.13] tracking-[-0.035em]">
            A little more aware.
          </h1>
          <p className="mt-2 text-sm text-[#c7bfdd]">Your world, in sight.</p>
        </div>
      </section>

      <div className="relative z-10 -mt-10 flex flex-1 flex-col px-5 pb-7">
        <MonitoringCard />

        <div className="mt-6 space-y-3">
          <Link
            href="/alerts"
            className="group flex min-h-[91px] items-center gap-4 rounded-[23px] bg-[#eee8fc] px-5 py-4 text-[#302348] transition-colors hover:bg-white"
          >
            <span className="text-[#9467e8]"><NavigationIcon name="alerts" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold">Sound Alerts</span>
              <span className="mt-1 block text-xs text-[#6d6382]">Know what’s happening nearby</span>
            </span>
            <span aria-hidden="true" className="text-[22px] leading-none transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5">↗</span>
          </Link>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/captions"
              className="flex min-h-[142px] flex-col items-start justify-between rounded-[23px] bg-[#293254] px-4 py-5 transition-colors hover:bg-[#36416b]"
            >
              <span className="text-[#a9bfff]"><NavigationIcon name="captions" /></span>
              <span>
                <span className="block text-[15px] font-semibold leading-tight">Live Captions</span>
                <span className="mt-1.5 block text-xs text-[#c0c7e2]">Follow every word</span>
              </span>
            </Link>
            <Link
              href="/speak"
              className="flex min-h-[142px] flex-col items-start justify-between rounded-[23px] bg-[#3b294d] px-4 py-5 transition-colors hover:bg-[#51375f]"
            >
              <SoundWaveIcon className="text-[#d7b8ee]" />
              <span>
                <span className="block text-[15px] font-semibold leading-tight">Type to Speak</span>
                <span className="mt-1.5 block text-xs text-[#d2bddb]">Let your words out</span>
              </span>
            </Link>
          </div>
        </div>

        <section aria-labelledby="recent-activity-title" className="mt-7">
          <div className="flex items-center justify-between gap-3">
            <h2 id="recent-activity-title" className="text-lg font-semibold">Recent activity</h2>
            <Link href="/alerts" className="inline-flex min-h-11 items-center text-xs text-[#cdb5ff] hover:text-white">
              View all
            </Link>
          </div>
          <p className="mt-0.5 text-[11px] text-[#ada2c7]">Demo preview · Not live detections</p>
          <div className="mt-3 space-y-1">
            {previewActivity.map((event) => (
              <Link
                href="/alerts"
                key={event.label}
                className="flex min-h-[61px] items-center gap-3 rounded-xl px-1 transition-colors hover:bg-white/5"
              >
                <span className={event.critical ? "text-[#ff687b]" : "text-[#8caaff]"}>
                  {event.critical ? <SirenIcon /> : <NavigationIcon name="alerts" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium">{event.label}</span>
                  <span className="mt-0.5 block text-[11px] text-[#b4acc9]">{event.detail}</span>
                </span>
                <span className="shrink-0 text-[11px] text-[#b4acc9]">{event.time}</span>
              </Link>
            ))}
          </div>
        </section>

        <details className="mt-5 rounded-2xl border border-white/10 text-sm text-[#c3b9d9]">
          <summary className="min-h-11 cursor-pointer px-4 py-3 font-medium">
            Audio reception diagnostics
          </summary>
          <div className="px-3 pb-3 text-white">
            <ConnectionControls diagnosticsOnly />
          </div>
        </details>
      </div>
    </main>
  );
}
