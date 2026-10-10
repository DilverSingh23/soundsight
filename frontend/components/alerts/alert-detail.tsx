import Link from "next/link";
import AlertIcon from "@/components/alerts/alert-icon";
import type { DemoSound } from "@/components/alerts/demo-sounds";
import SeverityBadge from "@/components/ui/severity-badge";

type AlertDetailProps = { sound: DemoSound };

const accent = {
  critical: {
    ring: "border-[#f3677b]/25",
    icon: "border-[#f3677b]/50 bg-[#f3677b]/15 text-[#ff7387]",
    glow: "bg-[#ea456e]/20",
    dot: "bg-[#ff7387]",
    badge: "text-[#ffb9c7]",
  },
  important: {
    ring: "border-[#ad81ff]/25",
    icon: "border-[#ad81ff]/50 bg-[#9568ed]/15 text-[#c59bff]",
    glow: "bg-[#9568ed]/20",
    dot: "bg-[#c59bff]",
    badge: "text-[#d3baff]",
  },
  ambient: {
    ring: "border-[#91a8ec]/25",
    icon: "border-[#91a8ec]/50 bg-[#91a8ec]/15 text-[#bdd0ff]",
    glow: "bg-[#91a8ec]/20",
    dot: "bg-[#bdd0ff]",
    badge: "text-[#d0ddff]",
  },
} satisfies Record<DemoSound["severity"], Record<string, string>>;

/** Visual demo detail. A live backend event is not available at this stage. */
export default function AlertDetail({ sound }: AlertDetailProps) {
  const colors = accent[sound.severity];

  return (
    <main
      className="relative flex min-h-full flex-1 flex-col overflow-hidden bg-[radial-gradient(ellipse_at_50%_38%,#402039_0%,#271a36_46%,#161329_87%)] text-light-on-dark"
      aria-label={`${sound.title} sample alert details`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-28 h-72 w-72 -translate-x-1/2 rounded-full bg-[#ad4270]/10 blur-[75px]"
      />

      <header className="relative z-10 flex items-center justify-between gap-4 px-6 pt-9">
        <Link
          href="/alerts"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl pr-3 text-xs text-[#e4d9ee] hover:text-white"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Alerts
        </Link>
        <span className="text-[9px] font-medium tracking-[0.15em] text-[#b8a7c3]">
          SAMPLE ALERT
        </span>
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center px-6 pb-7 text-center">
        <div
          aria-hidden="true"
          className="relative mt-5 flex aspect-square w-[min(76vw,290px)] shrink-0 items-center justify-center"
        >
          <div className={`absolute inset-[2%] rounded-full border ${colors.ring} opacity-35`} />
          <div className={`absolute inset-[13%] rounded-full border ${colors.ring} opacity-55`} />
          <div className={`absolute inset-[25%] rounded-full border ${colors.ring} opacity-75`} />
          <div className={`absolute inset-[36%] rounded-full border ${colors.ring}`} />
          <div className={`absolute inset-[28%] rounded-full ${colors.glow} blur-3xl`} />
          <span className={`absolute left-[15%] top-[38%] h-[5px] w-[5px] rounded-full ${colors.dot} shadow-[0_0_12px_currentColor]`} />
          <span className={`absolute bottom-[24%] right-[17%] h-[3px] w-[3px] rounded-full ${colors.dot} opacity-80`} />
          <div className={`relative flex h-[90px] w-[90px] items-center justify-center rounded-[30px] border ${colors.icon} shadow-[0_0_55px_rgba(238,76,121,0.16)]`}>
            <span className="[&>svg]:h-10 [&>svg]:w-10">
              <AlertIcon kind={sound.kind} />
            </span>
          </div>
        </div>

        <h1 className="mt-2 font-display text-[36px] leading-[1.12] tracking-[-0.03em] text-[#fff9ff]">
          {sound.title}
        </h1>
        <SeverityBadge
          severity={sound.severity}
          className={`mt-5 border border-white/10 bg-white/10 px-3 py-1 ${colors.badge}`}
        />
        <p className="mt-3 text-[11px] text-[#b6a7c5]">
          Demo preview · not a live sound detection
        </p>
        <p className="mt-7 max-w-[300px] text-[14px] leading-[1.8] text-[#e8dfee]">
          {sound.message}
          <span className="block">{sound.guidance}</span>
        </p>

        <div className="mt-auto w-full max-w-[340px] pt-10">
          <Link
            href="/captions"
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[15px] bg-[linear-gradient(135deg,#9565df,#6e46c7)] px-4 py-3 text-[13px] font-medium text-white shadow-[0_10px_30px_rgba(104,65,190,0.32)] transition-[filter] hover:brightness-110"
          >
            <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <path d="M7 10h4m-4 4h4m2-4h4m-4 4h4" />
            </svg>
            Open Live Captions
          </Link>
          <Link
            href="/alerts"
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-[13px] text-[#c8b9d7] hover:text-white"
          >
            Dismiss
          </Link>
        </div>
      </div>
    </main>
  );
}
