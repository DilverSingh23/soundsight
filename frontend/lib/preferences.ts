"use client";

import { useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "soundsight.preferences.v1";
const PREFERENCES_UPDATED = "soundsight:preferences-updated";

export type SoundCategory = "siren" | "doorbell" | "speech" | "dog" | "horn";
export type TranscriptTextSize = "small" | "regular" | "large";
export type VoiceLocale = "en-US" | "en-GB";

export type SoundSightPreferences = {
  notifications: boolean;
  speechDetection: boolean;
  soundCategories: Record<SoundCategory, boolean>;
  textSize: TranscriptTextSize;
  highContrast: boolean;
  voiceLocale: VoiceLocale;
  speakingRate: number;
};

export const defaultPreferences: SoundSightPreferences = {
  notifications: true,
  speechDetection: true,
  soundCategories: { siren: true, doorbell: true, speech: true, dog: true, horn: true },
  textSize: "regular",
  highContrast: false,
  voiceLocale: "en-US",
  speakingRate: 1,
};

export const soundCategoryLabels: Record<SoundCategory, string> = {
  siren: "Emergency sirens",
  doorbell: "Doorbell",
  speech: "Speech nearby",
  dog: "Dog barking",
  horn: "Car horn",
};

const DEFAULT_SNAPSHOT = JSON.stringify(defaultPreferences);

function getSnapshot(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_SNAPSHOT;
  } catch {
    return DEFAULT_SNAPSHOT;
  }
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(PREFERENCES_UPDATED, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(PREFERENCES_UPDATED, onChange);
  };
}

function parsePreferences(snapshot: string): SoundSightPreferences {
  try {
    const saved: Partial<SoundSightPreferences> = JSON.parse(snapshot);
    if (typeof saved !== "object" || saved === null) return defaultPreferences;
    const categories = saved.soundCategories;
    return {
      notifications: typeof saved.notifications === "boolean" ? saved.notifications : defaultPreferences.notifications,
      speechDetection: typeof saved.speechDetection === "boolean" ? saved.speechDetection : defaultPreferences.speechDetection,
      soundCategories: {
        siren: typeof categories?.siren === "boolean" ? categories.siren : true,
        doorbell: typeof categories?.doorbell === "boolean" ? categories.doorbell : true,
        speech: typeof categories?.speech === "boolean" ? categories.speech : true,
        dog: typeof categories?.dog === "boolean" ? categories.dog : true,
        horn: typeof categories?.horn === "boolean" ? categories.horn : true,
      },
      textSize: saved.textSize === "small" || saved.textSize === "large" ? saved.textSize : "regular",
      highContrast: typeof saved.highContrast === "boolean" ? saved.highContrast : false,
      voiceLocale: saved.voiceLocale === "en-GB" ? "en-GB" : "en-US",
      speakingRate: typeof saved.speakingRate === "number" && saved.speakingRate >= 0.7 && saved.speakingRate <= 1.3
        ? saved.speakingRate
        : 1,
    };
  } catch {
    return defaultPreferences;
  }
}

/** Share preferences across routes and tabs without SSR hydration mismatches. */
export function useSoundSightPreferences(): SoundSightPreferences {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_SNAPSHOT);
  return useMemo(() => parsePreferences(snapshot), [snapshot]);
}

export function updateSoundSightPreferences(changes: Partial<SoundSightPreferences>): boolean {
  const current = parsePreferences(getSnapshot());
  const updated: SoundSightPreferences = {
    ...current,
    ...changes,
    soundCategories: { ...current.soundCategories, ...changes.soundCategories },
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event(PREFERENCES_UPDATED));
    return true;
  } catch {
    return false;
  }
}
