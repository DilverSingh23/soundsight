import SoundAlerts from "../../components/SoundAlert";
import BackendStatus from "../../components/BackendStatus";

export default function AlertsPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-xl px-5 pt-5">
        <BackendStatus />
      </div>

      <SoundAlerts />
    </main>
  );
}
