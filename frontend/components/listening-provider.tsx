"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { startMicrophoneStream, type AudioStats, type ListeningStatus, type Classification, type ClassificationStatus, type SoundEvent } from "@/lib/microphone-stream";

import { DeepgramClient, type DeepgramConnectionStatus } from "@/lib/deepgram";
import { startLiveCaptionsSession } from "@/lib/live-captions-session";
import { applySpeechMessage, closeSpeechSessions, expireSpeechSessions, SPEECH_PAUSE_SECONDS, type SpeechSession } from "@/lib/speech-sessions";

export type ReceivedSoundEvent = SoundEvent & { receivedAt: string };

export type SpeechNotification = { type: "speech_event"; id: string; sessionId: string; label: string; preview: string; severity: "important" };
type ListeningState = {
  status: ListeningStatus;
  message: string;
  stats: AudioStats | null;
  classification: Classification | null;
  classificationStatus: ClassificationStatus | null;
  soundEvents: ReceivedSoundEvent[];
  clearSoundEvents: () => void;
  active: boolean;
  start: () => void;
  stop: () => void;
  transcriptionStatus: DeepgramConnectionStatus;
  transcriptionMessage: string;
  speechSessions: SpeechSession[];
  latestNotification: ReceivedSoundEvent | SpeechNotification | null;
  clearConversations: () => void;
};

const ListeningContext = createContext<ListeningState | null>(null);

export function ListeningProvider({ children }: { children: ReactNode }) {
  const cleanupRef = useRef<((graceful?: boolean) => void) | null>(null);
  const activeRef = useRef(false);
  const currentSpeechRef = useRef<SpeechSession[]>([]);
  const generation = useRef(0);
  const [status, setStatus] = useState<ListeningStatus>("Stopped");
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState<AudioStats | null>(null);

  const [classification, setClassification] = useState<Classification | null>(null);
  const [classificationStatus, setClassificationStatus] = useState<ClassificationStatus | null>(null);
  const [soundEvents, setSoundEvents] = useState<ReceivedSoundEvent[]>([]);

  const [transcriptionStatus, setTranscriptionStatus] = useState<DeepgramConnectionStatus>("idle");
  const [transcriptionMessage, setTranscriptionMessage] = useState("");
  const [speechSessions, setSpeechSessions] = useState<SpeechSession[]>([]);
  const [latestNotification, setLatestNotification] = useState<ReceivedSoundEvent | SpeechNotification | null>(null);

  function updateSpeech(next: SpeechSession[]) {
    const previous = currentSpeechRef.current;
    const previousIds = new Set(previous.map((speech) => speech.id));
    currentSpeechRef.current = next;
    setSpeechSessions((history) => [...next, ...history.filter((speech) => !previousIds.has(speech.id))].slice(0, 50));
    const created = next.find((speech) => !previousIds.has(speech.id));
    if (created) {
      setLatestNotification({ type: "speech_event", id: created.id, sessionId: created.id, label: "Speech recognized", preview: created.preview, severity: "important" });
    } else {
      setLatestNotification((notification) => {
        if (notification?.type !== "speech_event") return notification;
        const speech = next.find((item) => item.id === notification.sessionId);
        return speech ? { ...notification, preview: speech.preview } : notification;
      });
    }
  }

  useEffect(() => () => {
    generation.current++;
    activeRef.current = false;
    cleanupRef.current?.();
  }, []);

  function start() {
    if (activeRef.current) return;
    cleanupRef.current?.();
    activeRef.current = true;
    const session = ++generation.current;
    setStats(null);
    setClassification(null);
    setClassificationStatus(null);
    currentSpeechRef.current = [];
    let samplesSent = 0;
    let lastExpiryCheck = 0;
    setTranscriptionStatus("authenticating");
    setTranscriptionMessage("Preparing live transcription…");
    cleanupRef.current = startLiveCaptionsSession({
      onStatus(next, detail) {
        if (session !== generation.current) return;
        activeRef.current = next !== "Stopped" && next !== "Error";
        setStatus(next);
        setMessage(detail);
      },
      onClassification(next) {
        if (session === generation.current) setClassification(next);
      },
      onClassificationStatus(next) {
        if (session === generation.current) setClassificationStatus(next);
      },
      onSoundEvent(next) {
        if (session !== generation.current) return;
        const received = { ...next, receivedAt: new Date().toISOString() };
        setLatestNotification(received);
        setSoundEvents((previous) => previous.some((event) => event.id === next.id)
          ? previous : [received, ...previous].slice(0, 100));
      },
      onStats(next) {
        if (session === generation.current) setStats(next);
      },
      onTranscriptionStatus(next, detail) {
        if (session !== generation.current) return;
        setTranscriptionStatus(next);
        setTranscriptionMessage(detail);
        if (next === "error" || next === "disconnected") updateSpeech(closeSpeechSessions(currentSpeechRef.current));
      },
      onTranscript(incoming) {
        if (session !== generation.current) return;
        updateSpeech(expireSpeechSessions(
          applySpeechMessage(currentSpeechRef.current, incoming, () => crypto.randomUUID(), new Date().toISOString()),
          samplesSent / 16000,
        ));
      },
      onAudio(audio) {
        samplesSent += audio.byteLength / 2;
        const audioTime = samplesSent / 16000;
        if (audioTime - lastExpiryCheck < 1) return;
        lastExpiryCheck = audioTime;
        if (currentSpeechRef.current.some((speech) => speech.active && audioTime - speech.lastSpeechAudioTime >= SPEECH_PAUSE_SECONDS)) {
          updateSpeech(expireSpeechSessions(currentSpeechRef.current, audioTime));
        }
      },
      onEnded() {
        if (session !== generation.current) return;
        updateSpeech(closeSpeechSessions(currentSpeechRef.current));
        cleanupRef.current = null;
        setTranscriptionStatus("disconnected");
      },
    }, (callbacks) => new DeepgramClient(callbacks), startMicrophoneStream);
  }

  function stop() {
    cleanupRef.current?.(true);
  }

  return (
    <ListeningContext.Provider value={{ status, message, stats, classification, classificationStatus, soundEvents, clearSoundEvents: () => setSoundEvents([]), active: status !== "Stopped" && status !== "Error", start, stop, transcriptionStatus, transcriptionMessage, speechSessions, latestNotification, clearConversations: () => { currentSpeechRef.current = []; setSpeechSessions([]); } }}>
      {children}
    </ListeningContext.Provider>
  );
}

export function useListening() {
  const state = useContext(ListeningContext);
  if (!state) throw new Error("useListening requires ListeningProvider.");
  return state;
}
