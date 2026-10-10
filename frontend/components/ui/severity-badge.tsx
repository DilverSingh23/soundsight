export type SoundSeverity = "critical" | "important" | "ambient";

type SeverityBadgeProps = {
  severity: SoundSeverity;
  className?: string;
};

const severityStyles: Record<SoundSeverity, string> = {
  critical: "bg-critical/10 text-critical",
  important: "bg-brand-soft text-brand-deep",
  ambient: "bg-surface-muted text-muted",
};

/** Severity always includes readable text, never color alone. */
export default function SeverityBadge({
  severity,
  className = "",
}: SeverityBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
        severityStyles[severity],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {severity}
    </span>
  );
}
