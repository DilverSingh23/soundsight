"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeepgramClient, type DeepgramConnectionStatus } from "@/lib/deepgram";
import { startDeepgramMicrophone, type DeepgramMicrophoneStatus } from "@/lib/deepgram-microphone";
import { startLiveCaptionsSession } from "@/lib/live-captions-session";
import {
  applyDeepgramMessage,
  emptyDeepgramTranscript,
  getFinalTranscript,
  getVisibleTranscript,
  type DeepgramTranscript,
} from "@/lib/deepgram-transcript";

/** Owns a single real-caption session, including Picovoice and Deepgram. */
export function useDeepgram() {
  const stopRef = useRef<(() => void) | null>(null);
  const generationRef = useRef(0);
  const [status, setStatus] = useState<DeepgramConnectionStatus>("idle");
  const [microphoneStatus, setMicrophoneStatus] = useState<DeepgramMicrophoneStatus | "idle">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [transcript, setTranscript] = useState<DeepgramTranscript>(emptyDeepgramTranscript);

  useEffect(() => () => {
    // Ignore late network events after leaving the Captions route.
    generationRef.current++;
    stopRef.current?.();
    stopRef.current = null;
  }, []);

  const startListening = useCallback((): boolean => {
    if (stopRef.current) return false;
    const session = ++generationRef.current;
    setTranscript(emptyDeepgramTranscript());
    setMicrophoneStatus("connecting");
    setStatus("authenticating");
    setStatusMessage("Connecting to Deepgram before requesting microphone access…");

    try {
      const stop = startLiveCaptionsSession({
        onConnectionStatus(nextStatus, message) {
          if (session !== generationRef.current) return;
          setStatus(nextStatus);
          setStatusMessage(message);
        },
        onMicrophoneStatus(nextStatus, message) {
          if (session !== generationRef.current) return;
          setMicrophoneStatus(nextStatus);
          setStatusMessage(message);
        },
        onMessage(message) {
          if (session !== generationRef.current) return;
          setTranscript((previous) => applyDeepgramMessage(previous, message));
        },
        onEnded() {
          if (session === generationRef.current) {
            stopRef.current = null;
            // Interrupted provisional text is not a finalized caption.
            setTranscript((previous) => previous.interimText
              ? { ...previous, interimText: "" } : previous);
          }
        },
      }, (callbacks) => new DeepgramClient(callbacks), startDeepgramMicrophone);
      if (session === generationRef.current) stopRef.current = stop;
      else stop();
      return true;
    } catch {
      setMicrophoneStatus("error");
      setStatus("error");
      setStatusMessage("Could not start live captions. Please try again.");
      stopRef.current = null;
      return false;
    }
  }, []);

  const stopListening = useCallback((): void => {
    generationRef.current++;
    stopRef.current?.();
    stopRef.current = null;
    setMicrophoneStatus("stopped");
    setStatus("disconnected");
    setStatusMessage("Microphone released and Deepgram session stopped.");
    setTranscript((previous) => previous.interimText
      ? { ...previous, interimText: "" } : previous);
    // Keep confirmed captions visible until Clear Transcript or a new session.
  }, []);

  const clearTranscript = useCallback((): void => setTranscript(emptyDeepgramTranscript()), []);
  const finalTranscript = useMemo(() => getFinalTranscript(transcript), [transcript]);
  const visibleTranscript = useMemo(() => getVisibleTranscript(transcript), [transcript]);

  return {
    status,
    microphoneStatus,
    statusMessage,
    transcript,
    finalTranscript,
    interimTranscript: transcript.interimText,
    visibleTranscript,
    startListening,
    stopListening,
    clearTranscript,
  };
}
