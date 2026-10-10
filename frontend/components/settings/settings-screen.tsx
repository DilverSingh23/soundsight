"use client";

import Link from "next/link";
import { useState } from "react";
import {
  soundCategoryLabels,
  updateSoundSightPreferences,
  useSoundSightPreferences,
  type SoundCategory,
  type SoundSightPreferences,
  type TranscriptTextSize,
} from "@/lib/preferences";

const categoryKeys: readonly SoundCategory[] = ["siren", "doorbell", "speech", "dog", "horn"];

type SettingIconName = "bell" | "wave" | "speech" | "text" | "contrast" | "voice" | "privacy";

function SettingIcon({ kind }: { kind: SettingIconName }) {
  return (
    <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {kind === "bell" && <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>}
      {kind === "wave" && <path d="M2 10v4m4-8v12m4-16v20m4-13v6m4-10v14m4-9v4" />}
      {kind === "speech" && <><rect x="3" y="4" width="15" height="12" rx="3" /><path d="M7 8h7M7 11h4M10 16v4l4-4M19 10h2v10h-7" /></>}
      {kind === "text" && <><path d="M4 5h16M12 5v15M8 20h8" /></>}
      {kind === "contrast" && <><circle cx="12" cy="12" r="9" /><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" /></>}
      {kind === "voice" && <><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M16 9a5 5 0 0 1 0 6M19 6a9 9 0 0 1 0 12" /></>}
      {kind === "privacy" && <><path d="M12 3 5 6v6c0 5 3.4 7.6 7 9 3.6-1.4 7-4 7-9V6z" /><path d="m9 12 2 2 4-4" /></>}
    </svg>
  );
}

type SettingRowProps = {
  icon: SettingIconName;
  label: string;
  detail?: string;
  children?: React.ReactNode;
};

function SettingRow({ icon, label, detail, children }: SettingRowProps) {
  return (
    <div className="flex min-h-[59px] items-center gap-3 px-4 py-2.5">
      <span className="shrink-0 text-[#8757dd]"><SettingIcon kind={icon} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-[1.4] text-foreground">{label}</p>
        {detail && <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{detail}</p>}
      </div>
      {children}
    </div>
  );
}

function SettingSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative flex h-[27px] w-[47px] shrink-0 items-center rounded-full border transition-colors after:absolute after:left-[3px] after:h-[19px] after:w-[19px] after:rounded-full after:bg-white after:shadow-sm after:transition-transform ${checked ? "border-[#986af6] bg-[#9764ee] after:translate-x-[20px]" : "border-[#d4cede] bg-[#d6d0df]"}`}
    />
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">{title}</h2>
      <div className="divide-y divide-[#dfd8e9] overflow-hidden rounded-[20px] bg-[#eee8f6]">{children}</div>
    </section>
  );
}

export default function SettingsScreen() {
  const preferences = useSoundSightPreferences();
  const [saveError, setSaveError] = useState(false);
  const activeCategories = categoryKeys.filter((key) => preferences.soundCategories[key]).length;

  function save(changes: Partial<SoundSightPreferences>) {
    setSaveError(!updateSoundSightPreferences(changes));
  }

  return (
    <main className="flex flex-1 flex-col bg-[#fbf9f7] px-5 pb-9 pt-[max(2.75rem,env(safe-area-inset-top))] text-foreground">
      <header>
        <h1 className="font-display text-[35px] leading-[1.15] tracking-[-0.035em]">Make it yours</h1>
        <p className="mt-2 text-xs text-muted">Small adjustments. A world of difference.</p>
      </header>

      <SettingsGroup title="Sound & awareness">
        <SettingRow icon="bell" label="Notifications">
          <SettingSwitch label="Save notification preference" checked={preferences.notifications} onChange={(checked) => save({ notifications: checked })} />
        </SettingRow>
        <details>
          <summary className="flex min-h-[59px] cursor-pointer list-none items-center gap-3 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
            <span className="text-[#8757dd]"><SettingIcon kind="wave" /></span>
            <span className="min-w-0 flex-1 text-[13px] font-medium">Sound categories</span>
            <span className="text-[11px] text-muted">{activeCategories} enabled</span>
            <span aria-hidden="true" className="text-lg text-muted">›</span>
          </summary>
          <div className="space-y-0.5 border-t border-[#ded4ed] px-4 py-2">
            {categoryKeys.map((key) => (
              <label key={key} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-2 text-[12px] hover:bg-white/50">
                <span>{soundCategoryLabels[key]}</span>
                <input
                  type="checkbox"
                  checked={preferences.soundCategories[key]}
                  onChange={(event) => save({ soundCategories: { ...preferences.soundCategories, [key]: event.target.checked } })}
                  className="h-5 w-5 accent-[#895bea]"
                />
              </label>
            ))}
          </div>
        </details>
        <SettingRow icon="speech" label="Speech detection">
          <SettingSwitch label="Save speech detection preference" checked={preferences.speechDetection} onChange={(checked) => save({ speechDetection: checked })} />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Reading & display">
        <SettingRow icon="text" label="Text size">
          <label htmlFor="preferred-text-size" className="sr-only">Default caption text size</label>
          <select
            id="preferred-text-size"
            value={preferences.textSize}
            onChange={(event) => save({ textSize: event.target.value as TranscriptTextSize })}
            className="min-h-11 rounded-lg bg-transparent px-1 text-[12px] capitalize text-muted"
          >
            <option value="small">Small</option>
            <option value="regular">Regular</option>
            <option value="large">Large</option>
          </select>
        </SettingRow>
        <SettingRow icon="contrast" label="High contrast">
          <SettingSwitch label="High contrast" checked={preferences.highContrast} onChange={(checked) => save({ highContrast: checked })} />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Voice & privacy">
        <SettingRow icon="voice" label="Voice settings" detail={`${preferences.voiceLocale === "en-GB" ? "English (UK)" : "English (US)"} · ${preferences.speakingRate.toFixed(1)}×`}>
          <Link href="/speak" aria-label="Open voice settings in Type to Speak" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-xl text-muted hover:bg-white/60">›</Link>
        </SettingRow>
        <details>
          <summary className="flex min-h-[59px] cursor-pointer list-none items-center gap-3 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
            <span className="text-[#8757dd]"><SettingIcon kind="privacy" /></span>
            <span className="flex-1 text-[13px] font-medium">Privacy</span>
            <span aria-hidden="true" className="text-lg text-muted">›</span>
          </summary>
          <p className="border-t border-[#ded4ed] px-4 py-3 text-xs leading-relaxed text-muted">SoundSight does not upload typed messages or save audio in this frontend preview. Browser speech voices may use device or network processing. Preferences are stored in this browser.</p>
        </details>
      </SettingsGroup>

      <div className="mt-6 flex items-start gap-3 rounded-[18px] px-1 text-[#8655d9]">
        <span className="pt-0.5"><SettingIcon kind="privacy" /></span>
        <div>
          <p className="text-xs font-semibold text-foreground">Your preferences stay with this browser.</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">These switches save preferences only. Real push notifications and sound detection require your teammates’ backend and PWA integrations.</p>
        </div>
      </div>
      {saveError && <p role="alert" className="mt-4 text-xs font-semibold text-critical">Your browser blocked saving preferences. Check storage permissions.</p>}
    </main>
  );
}
