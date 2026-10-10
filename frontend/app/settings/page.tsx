import ScreenHeading from "@/components/ui/screen-heading";

/** Temporary destination so the Settings navigation tab is functional. */
export default function SettingsPage() {
  return (
    <main className="flex flex-1 flex-col px-6 pt-10">
      <ScreenHeading
        title="Make it yours"
        subtitle="Small adjustments. A world of difference."
      />
      <section
        aria-label="Settings availability"
        className="mt-10 rounded-3xl border border-outline bg-surface p-6"
      >
        <p className="text-base font-medium">Preferences are coming soon.</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Notification categories, text size, contrast, and voice settings will
          be available here in the upcoming settings implementation.
        </p>
      </section>
    </main>
  );
}
