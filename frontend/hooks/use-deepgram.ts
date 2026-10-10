"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeepgramClient, type DeepgramConnectionStatus } from "@/lib/deepgram";
import {
  applyDeepgramMessage,
  emptyDeepgramTranscript,
  getFinalTranscript,
  getVisibleTranscript,
  type DeepgramTranscript,
} from "@/lib/deepgram-transcript";

/**
 * React-facing Deepgram session state. This hook does not request mic access;
 * the existing Picovoice capture will supply PCM in the integration commit.
 */
export function useDeepgram() {
  const clientRef = useRef<DeepgramClient | null>(null);
  const generationRef = useRef(0);
  const [status, setStatus] = useState<DeepgramConnectionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [transcript, setTranscript] = useState<DeepgramTranscript>(emptyDeepgramTranscript);

  useEffect(() => () => {
    // Ignore events from a previous session, including late network responses.
    generationRef.current += 1;
    clientRef.current?.disconnect();
    clientRef.current = null;
  }, []);

  const connect = useCallback(async (): Promise<void> => {
    if (clientRef.current) throw new Error("Deepgram is already connecting or connected.");
    const generation = ++generationRef.current;
    setTranscript(emptyDeepgramTranscript());

    const client = new DeepgramClient({
      onStatus(nextStatus, message) {
        if (generation !== generationRef.current) return;
        setStatus(nextStatus);
        setStatusMessage(message);
        if ((nextStatus === "error" || nextStatus === "disconnected") && clientRef.current === client) {
          clientRef.current = null;
        }
      },
      onMessage(message) {
        if (generation !== generationRef.current) return;
        setTranscript((previous) => applyDeepgramMessage(previous, message));
      },
    });
    clientRef.current = client;
    try {
      await client.connect();
    } catch (error) {
      if (generation === generationRef.current && clientRef.current === client) {
        clientRef.current = null;
        setStatus("error");
        setStatusMessage("Could not establish a Deepgram session.");
      }
      throw error;
    }
  }, []);

  const sendAudio = useCallback((audio: ArrayBuffer): void => {
    if (!clientRef.current) throw new Error("Deepgram is not connected.");
    clientRef.current.sendAudio(audio);
  }, []);

  const disconnect = useCallback((): void => {
    generationRef.current += 1;
    const client = clientRef.current;
    clientRef.current = null;
    client?.disconnect();
    setStatus("disconnected");
    setStatusMessage("Deepgram session stopped.");
    // Preserve completed captions for review until another session starts.
  }, []);

  const clearTranscript = useCallback((): void => setTranscript(emptyDeepgramTranscript()), []);
  const finalTranscript = useMemo(() => getFinalTranscript(transcript), [transcript]);
  const visibleTranscript = useMemo(() => getVisibleTranscript(transcript), [transcript]);

  return {
    status,
    statusMessage,
    transcript,
    finalTranscript,
    interimTranscript: transcript.interimText,
    visibleTranscript,
    connect,
    sendAudio,
    disconnect,
    clearTranscript,
  };
}
