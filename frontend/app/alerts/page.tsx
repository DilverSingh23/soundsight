import SoundAlerts from "@/components/SoundAlert";
import BackendStatus from "@/components/BackendStatus";

export default function AlertsPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col bg-background text-foreground">
      <SoundAlerts />
      <details className="mx-5 mb-8 rounded-2xl border border-outline bg-surface px-4 py-3 text-foreground">
        <summary className="min-h-11 cursor-pointer py-3 text-xs font-medium text-muted">
          Backend connection diagnostics
        </summary>
        <p className="mb-3 text-xs leading-relaxed text-muted">
          Connectivity status is separate from environmental sound detection.
        </p>
        <BackendStatus />
      </details>
    </main>
  );
}
