"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  updateSoundSightPreferences,
  useSoundSightPreferences,
  type VoiceLocale,
} from "@/lib/preferences";
import { speakWithElevenLabs } from "@/lib/text-to-speech";

const MAX_CHARACTERS = 500;
const DEFAULT_MESSAGE = "Hi! I’m hard of hearing. Could you please face me when you speak?";
const QUICK_PHRASES = ["Thank you", "Please repeat", "I need help"] as const;

type PlaybackState = "idle" | "speaking" | "finished" | "error";

function VoiceWave({ active = false }: { active?: boolean }) {
  return (
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round">
      <path d="M3 9v6M7 5v14m4-17v20m4-14v8m4-12v16m4-11v6" />
      {active && <circle cx="22" cy="3" r="2" fill="currentColor" stroke="none" />}
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H3v6h3l5 4zM16 9a5 5 0 0 1 0 6M19 6a9 9 0 0 1 0 12" />
    </svg>
  );
}

export default function TypeToSpeak() {
  const preferences = useSoundSightPreferences();
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [playback, setPlayback] = useState<PlaybackState>("idle");
  const [notice, setNotice] = useState("");
  const [lastSpoken, setLastSpoken] = useState("");
  const activeUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const stopActive = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      stopActive.current?.();
      if (activeUtterance.current && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        activeUtterance.current = null;
      }
    };
  }, []);

  function stopSpeaking() {
    stopActive.current?.();
    stopActive.current = null;
    if (activeUtterance.current && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    activeUtterance.current = null;
    setPlayback("idle");
    setNotice("Speech stopped.");
  }

  // Browser speechSynthesis fallback — used when the backend/ElevenLabs request
  // fails, so type-to-speak never hangs (CLAUDE.md section 10).
  function speakWithBrowser(text: string) {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setPlayback("error");
      setNotice("Voice playback is unavailable in this browser.");
      return;
    }

    const synthesizer = window.speechSynthesis;
    synthesizer.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = preferences.voiceLocale;
    utterance.rate = preferences.speakingRate;
    const voices = synthesizer.getVoices();
    const matchingVoice = voices.find((voice) => voice.lang === preferences.voiceLocale)
      ?? voices.find((voice) => voice.lang.startsWith(preferences.voiceLocale.slice(0, 2)));
    if (matchingVoice) utterance.voice = matchingVoice;

    activeUtterance.current = utterance;
    stopActive.current = () => synthesizer.cancel();
    setPlayback("speaking");
    setNotice("Voice playback unavailable; using device voice instead.");

    utterance.onstart = () => {
      if (activeUtterance.current === utterance) setNotice("Speaking your message (device voice)");
    };
    utterance.onend = () => {
      if (activeUtterance.current !== utterance) return;
      activeUtterance.current = null;
      stopActive.current = null;
      setPlayback("finished");
      setNotice("Message finished.");
    };
    utterance.onerror = (event) => {
      if (activeUtterance.current !== utterance) return;
      activeUtterance.current = null;
      stopActive.current = null;
      if (event.error === "canceled" || event.error === "interrupted") return;
      setPlayback("error");
      setNotice("Playback failed. Try another browser or device voice.");
    };
    synthesizer.speak(utterance);
  }

  function speak(textToSpeak = message) {
    const text = textToSpeak.trim();
    if (!text) {
      setNotice("Type a message or choose a quick phrase first.");
      return;
    }

    stopActive.current?.();
    stopActive.current = null;
    setLastSpoken(text);
    setPlayback("speaking");
    setNotice("Connecting to voice playback…");

    stopActive.current = speakWithElevenLabs(text, preferences.speakingRate, {
      onStart: () => setNotice("Speaking your message"),
      onEnd: () => {
        stopActive.current = null;
        setPlayback("finished");
        setNotice("Message finished.");
      },
      onError: () => {
        stopActive.current = null;
        speakWithBrowser(text);
      },
    });
  }

  const prefersLargeText = preferences.textSize === "large";

  return (
    <main className="flex flex-1 flex-col bg-[linear-gradient(180deg,#fbf9f6_10%,#f1ecfa_100%)] px-5 pb-8 pt-[max(2.75rem,env(safe-area-inset-top))] text-foreground">
      <header className="relative">
        <div className="flex items-center gap-2">
          <Link href="/" aria-label="Back to Home" className="flex min-h-11 min-w-7 items-center justify-center rounded-lg text-2xl text-muted hover:text-foreground">‹</Link>
          <h1 className="font-display text-[35px] leading-tight tracking-[-0.035em]">Type to Speak</h1>
        </div>
        <p className="ml-9 mt-0.5 text-xs text-muted">Your words. Out loud.</p>
      </header>

      <section aria-label="Compose speech message" className="mt-8 rounded-[25px] border border-[#dcd3ea] bg-white/90 p-4 shadow-[0_12px_30px_rgba(78,51,123,0.04)]">
        <label htmlFor="speak-message" className="sr-only">Message to speak</label>
        <textarea
          id="speak-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={MAX_CHARACTERS}
          rows={5}
          placeholder="Type something you want to say…"
          className={`min-h-[155px] w-full resize-y bg-transparent text-foreground placeholder:text-muted/70 focus:outline-none ${prefersLargeText ? "text-[22px] leading-[1.45]" : "text-[19px] leading-[1.55]"}`}
        />
        <div className="flex items-center justify-between gap-4 text-[11px] text-muted">
          <span className="tabular-nums">{message.length} / {MAX_CHARACTERS}</span>
          <button type="button" onClick={() => setMessage("")} className="min-h-11 rounded-lg px-3 text-brand-deep hover:bg-brand-soft">Clear</button>
        </div>
      </section>

      <div aria-label="Quick phrases" className="mt-4 flex flex-wrap gap-2">
        {QUICK_PHRASES.map((phrase) => (
          <button key={phrase} type="button" onClick={() => setMessage(phrase)} className="min-h-11 rounded-full bg-[#eee8fa] px-3.5 text-[12px] font-medium text-[#6d4ea1] transition-colors hover:bg-[#dfd2f7]">
            {phrase}
          </button>
        ))}
      </div>

      <section aria-label="Voice settings" className="mt-7 space-y-5">
        <div className="flex items-center gap-3 border-b border-[#e6deef] pb-3">
          <div className="text-brand"><VoiceWave /></div>
          <div className="min-w-0 flex-1">
            <label htmlFor="voice-locale" className="block text-[11px] text-muted">Voice</label>
            <select
              id="voice-locale"
              value={preferences.voiceLocale}
              onChange={(event) => updateSoundSightPreferences({ voiceLocale: event.target.value as VoiceLocale })}
              className="min-h-11 w-full cursor-pointer bg-transparent text-sm font-medium text-foreground"
            >
              <option value="en-US">Device voice · English (US)</option>
              <option value="en-GB">Device voice · English (UK)</option>
            </select>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs font-medium">
            <label htmlFor="speaking-speed">Speaking speed</label>
            <output htmlFor="speaking-speed" className="text-brand-deep tabular-nums">{preferences.speakingRate.toFixed(1)}×</output>
          </div>
          <input
            id="speaking-speed"
            aria-label="Speaking speed"
            type="range"
            min="0.7"
            max="1.3"
            step="0.1"
            value={preferences.speakingRate}
            onChange={(event) => updateSoundSightPreferences({ speakingRate: Number(event.target.value) })}
            className="mt-3 h-2 w-full cursor-pointer accent-[#8d5cef]"
          />
        </div>
      </section>

      <button
        type="button"
        onClick={() => speak()}
        disabled={!message.trim()}
        className="mt-6 flex min-h-[55px] w-full items-center justify-center gap-3 rounded-[16px] bg-[linear-gradient(120deg,#9161ed,#703ebb)] text-base font-semibold text-white shadow-[0_10px_25px_rgba(110,61,190,0.2)] transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <SpeakerIcon /> Speak
      </button>

      <section aria-label="Speech playback status" className="mt-4 rounded-2xl px-1 py-2" aria-live="polite">
        <div className="flex items-center gap-3">
          <span className={`text-[#9562eb] ${playback === "speaking" ? "motion-safe:animate-pulse" : ""}`}><VoiceWave active={playback === "speaking"} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-brand-deep">
              {playback === "speaking" ? "Speaking your message" : playback === "finished" ? "Ready to speak again" : playback === "error" ? "Playback unavailable" : "Ready to speak"}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">{notice || "Uses your browser’s speech feature."}</p>
          </div>
        </div>
        {playback === "speaking" && (
          <button onClick={stopSpeaking} type="button" className="mt-2 min-h-11 rounded-xl border border-[#c3a9e8] px-4 text-xs font-semibold text-brand-deep">Stop speaking</button>
        )}
        {playback === "finished" && lastSpoken && (
          <button onClick={() => speak(lastSpoken)} type="button" className="mt-2 min-h-11 rounded-xl border border-[#c3a9e8] px-4 text-xs font-semibold text-brand-deep">Replay message</button>
        )}
      </section>

      <p className="mt-4 text-[11px] leading-relaxed text-muted">Voice playback uses ElevenLabs when the backend is reachable, falling back to your browser’s built-in speech engine otherwise.</p>
    </main>
  );
}
