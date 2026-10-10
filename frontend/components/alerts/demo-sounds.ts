import type { SoundKind } from "@/components/alerts/alert-icon";
import type { SoundSeverity } from "@/components/ui/severity-badge";

/** Illustration-only data, not events from FastAPI or YAMNet. */
export type DemoSound = {
  kind: SoundKind;
  label: string;
  title: string;
  message: string;
  guidance: string;
  severity: SoundSeverity;
};

export const demoSounds = [
  {
    kind: "siren",
    label: "Siren detected",
    title: "Siren Detected",
    message: "An emergency vehicle siren may be audible.",
    guidance: "Stay aware of your surroundings.",
    severity: "critical",
  },
  {
    kind: "doorbell",
    label: "Doorbell",
    title: "Doorbell",
    message: "Someone may be at your door.",
    guidance: "Check your door when it is safe to do so.",
    severity: "important",
  },
  {
    kind: "speech",
    label: "Speech nearby",
    title: "Speech Nearby",
    message: "A person may be speaking close to the microphone.",
    guidance: "Open Live Captions to follow speech from your phone microphone.",
    severity: "important",
  },
  {
    kind: "dog",
    label: "Dog barking",
    title: "Dog Barking",
    message: "A dog may be barking within earshot of the microphone.",
    guidance: "This alert is for general sound awareness.",
    severity: "ambient",
  },
  {
    kind: "horn",
    label: "Car horn",
    title: "Car Horn",
    message: "A vehicle horn may be audible.",
    guidance: "Pay attention to your surroundings, especially near traffic.",
    severity: "important",
  },
] as const satisfies readonly DemoSound[];

export function findDemoSound(kind: string): DemoSound | undefined {
  return demoSounds.find((sound) => sound.kind === kind);
}
