"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { startMicrophoneStream, type AudioStats, type ListeningStatus, type Classification, type ClassificationStatus, type SoundEvent } from "@/lib/microphone-stream";

type ReceivedSoundEvent = SoundEvent & { receivedAt: string };

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
  claimCaptionsMicrophone: () => boolean;
  releaseCaptionsMicrophone: () => void;
};

const ListeningContext = createContext<ListeningState | null>(null);

export function ListeningProvider({ children }: { children: ReactNode }) {
  const cleanupRef = useRef<(() => void) | null>(null);
  const activeRef = useRef(false);
  const captionOwnerRef = useRef(false);
  const generation = useRef(0);
  const [status, setStatus] = useState<ListeningStatus>("Stopped");
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState<AudioStats | null>(null);

  const [classification, setClassification] = useState<Classification | null>(null);
  const [classificationStatus, setClassificationStatus] = useState<ClassificationStatus | null>(null);
  const [soundEvents, setSoundEvents] = useState<ReceivedSoundEvent[]>([]);

  useEffect(() => () => {
    generation.current++;
    activeRef.current = false;
    captionOwnerRef.current = false;
    cleanupRef.current?.();
  }, []);

  function start() {
    if (activeRef.current || captionOwnerRef.current) return;
    cleanupRef.current?.();
    activeRef.current = true;
    const session = ++generation.current;
    setStats(null);
    setClassification(null);
    setClassificationStatus(null);
    cleanupRef.current = startMicrophoneStream({
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
        setSoundEvents((previous) => previous.some((event) => event.id === next.id)
          ? previous : [received, ...previous].slice(0, 100));
      },
      onStats(next) {
        if (session === generation.current) setStats(next);
      },
    });
  }

  function stop() {
    generation.current++;
    activeRef.current = false;
    cleanupRef.current?.();
    cleanupRef.current = null;
    setStatus("Stopped");
    setMessage("Microphone released and connection closed.");
  }

  // Only one Picovoice subscription can run at a time. Claiming it for
  // captions cancels the Home diagnostics session, including pending setup.
  const claimCaptionsMicrophone = useCallback((): boolean => {
    if (captionOwnerRef.current) return false;
    captionOwnerRef.current = true;
    generation.current++;
    activeRef.current = false;
    cleanupRef.current?.();
    cleanupRef.current = null;
    setStatus("Stopped");
    setStats(null);
    setMessage("Microphone assigned to Live Captions.");
    return true;
  }, []);

  const releaseCaptionsMicrophone = useCallback((): void => {
    captionOwnerRef.current = false;
  }, []);

  return (
    <ListeningContext.Provider value={{ status, message, stats, classification, classificationStatus, soundEvents, clearSoundEvents: () => setSoundEvents([]), active: status !== "Stopped" && status !== "Error", start, stop, claimCaptionsMicrophone, releaseCaptionsMicrophone }}>
      {children}
    </ListeningContext.Provider>
  );
}

export function useListening() {
  const state = useContext(ListeningContext);
  if (!state) throw new Error("useListening requires ListeningProvider.");
  return state;
}
