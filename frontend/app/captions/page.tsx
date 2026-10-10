import ScreenHeading from "@/components/ui/screen-heading";

/** Temporary destination so the Captions navigation tab is functional. */
export default function CaptionsPage() {
  return (
    <main className="flex flex-1 flex-col px-6 pt-10">
      <ScreenHeading
        title="Live Captions"
        subtitle="Follow every word."
        inverted
      />
      <section
        aria-label="Captions availability"
        className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6"
      >
        <p className="text-base font-medium text-light-on-dark">
          Live transcription is coming next.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-on-dark">
          The microphone is not active. This screen will display live speech
          captions once the transcription feature is connected.
        </p>
      </section>
    </main>
  );
}
