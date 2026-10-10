import Link from "next/link";
import ScreenHeading from "@/components/ui/screen-heading";

/** Temporary destination until the Type to Speak Figma screen is implemented. */
export default function SpeakPage() {
  return (
    <main className="flex flex-1 flex-col bg-[linear-gradient(180deg,#fbf9f6_15%,#f0eafa_100%)] px-6 pt-10">
      <ScreenHeading title="Type to Speak" subtitle="Your words. Out loud." />
      <section className="mt-10 rounded-3xl border border-outline bg-white/80 p-6">
        <p className="font-medium text-foreground">Voice playback is coming soon.</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          This page will let you type a message and speak it aloud when the voice
          integration is ready. No microphone or playback is active right now.
        </p>
        <Link href="/" className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-brand-deep hover:underline">
          ← Back to Home
        </Link>
      </section>
    </main>
  );
}
