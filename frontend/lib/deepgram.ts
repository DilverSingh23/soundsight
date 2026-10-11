/**
 * Deepgram Live STT transport. Audio capture and transcript assembly live in
 * separate modules so a single microphone stream can feed this connection.
 * Never pass the permanent Deepgram API key to this module.
 */

export type DeepgramConnectionStatus =
  | "idle"
  | "authenticating"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export type DeepgramClientCallbacks = {
  onStatus: (status: DeepgramConnectionStatus, message: string) => void;
  onMessage: (message: unknown) => void;
};

// Matches Dilver's Picovoice output: 16 kHz mono, signed little-endian PCM.
const AUDIO_SAMPLE_RATE_HZ = 16_000;
const AUDIO_CHANNELS = 1;
const MAX_BUFFERED_AUDIO_BYTES = 32_000; // 1 second of 16 kHz, 16-bit mono audio.
const CONNECT_TIMEOUT_MS = 10_000;
const STREAM_FINISH_TIMEOUT_MS = 2_500; // Bound time waiting for final words on Stop.
const BACKEND_HTTP_URL =
  process.env.NEXT_PUBLIC_BACKEND_HTTP_URL ?? "http://localhost:8000";

export const DEEPGRAM_LISTEN_URL = (() => {
  const url = new URL("wss://api.deepgram.com/v1/listen");
  url.searchParams.set("model", "nova-3");
  url.searchParams.set("language", "en-US");
  url.searchParams.set("encoding", "linear16");
  url.searchParams.set("sample_rate", String(AUDIO_SAMPLE_RATE_HZ));
  url.searchParams.set("channels", String(AUDIO_CHANNELS));
  url.searchParams.set("interim_results", "true");
  url.searchParams.set("smart_format", "true");
  url.searchParams.set("endpointing", "300");
  return url.toString();
})();

type TokenResponse = {
  access_token: string;
  expires_in: number;
};

function isTokenResponse(value: unknown): value is TokenResponse {
  if (typeof value !== "object" || value === null) return false;
  if (!("access_token" in value) || !("expires_in" in value)) return false;
  return typeof value.access_token === "string"
    && value.access_token.length > 0
    && typeof value.expires_in === "number"
    && Number.isInteger(value.expires_in)
    && value.expires_in > 0;
}

/** One connection per instance. Create a new token for each connect/reconnect. */
export class DeepgramClient {
  private status: DeepgramConnectionStatus = "idle";
  private socket: WebSocket | null = null;
  private tokenRequest: AbortController | null = null;
  private generation = 0;
  private connecting = false;
  private pendingConnectionReject: ((error: Error) => void) | null = null;
  private finishingPromise: Promise<void> | null = null;
  private finishResolve: (() => void) | null = null;
  private finishTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly callbacks: DeepgramClientCallbacks;

  constructor(callbacks: DeepgramClientCallbacks) {
    this.callbacks = callbacks;
  }

  get currentStatus(): DeepgramConnectionStatus {
    return this.status;
  }

  private report(status: DeepgramConnectionStatus, message: string): void {
    this.status = status;
    this.callbacks.onStatus(status, message);
  }

  private resolveFinishing(): void {
    if (this.finishTimeout !== null) clearTimeout(this.finishTimeout);
    this.finishTimeout = null;
    const resolve = this.finishResolve;
    this.finishResolve = null;
    this.finishingPromise = null;
    resolve?.();
  }

  private removeSocket(socket: WebSocket): void {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    if (socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) {
      socket.close();
    }
    if (this.socket === socket) {
      this.socket = null;
      this.resolveFinishing();
    }
  }

  /** Connect only on a user action; no microphone audio is started here. */
  async connect(): Promise<void> {
    if (this.connecting || this.socket) {
      throw new Error("A Deepgram connection is already active.");
    }
    if (typeof window !== "undefined" && window.location.protocol === "https:"
      && BACKEND_HTTP_URL.startsWith("http:")) {
      throw new Error("Deepgram authentication requires an HTTPS backend on secure pages.");
    }

    const session = ++this.generation;
    const controller = new AbortController();
    const tokenTimeout = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
    this.tokenRequest = controller;
    this.connecting = true;
    this.report("authenticating", "Requesting temporary Deepgram credentials…");

    try {
      let response: Response;
      try {
        response = await fetch(`${BACKEND_HTTP_URL.replace(/\/$/, "")}/deepgram/token`, {
          method: "POST",
          cache: "no-store",
          signal: controller.signal,
        });
      } catch {
        if (session !== this.generation) throw new Error("Deepgram connection canceled.");
        throw new Error("Could not reach the SoundSight authentication backend.");
      }
      if (session !== this.generation) throw new Error("Deepgram connection canceled.");
      if (!response.ok) throw new Error("Could not obtain temporary Deepgram credentials.");

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error("The backend returned an invalid Deepgram token response.");
      }
      if (session !== this.generation) throw new Error("Deepgram connection canceled.");
      if (!isTokenResponse(payload)) {
        throw new Error("The backend returned an invalid Deepgram token response.");
      }
      clearTimeout(tokenTimeout);
      this.tokenRequest = null;
      this.report("connecting", "Connecting to Deepgram…");

      // A browser cannot set Authorization headers on WebSockets. Deepgram
      // accepts short-lived JWTs using the `bearer` WebSocket subprotocol.
      const socket = new WebSocket(DEEPGRAM_LISTEN_URL, ["bearer", payload.access_token]);
      this.socket = socket;

      await new Promise<void>((resolve, reject) => {
        let finished = false;
        const timeout = setTimeout(() => fail("Deepgram connection timed out."), CONNECT_TIMEOUT_MS);

        const fail = (message: string) => {
          if (finished) return;
          finished = true;
          clearTimeout(timeout);
          this.pendingConnectionReject = null;
          this.removeSocket(socket);
          reject(new Error(message));
        };

        this.pendingConnectionReject = (error) => fail(error.message);
        socket.onopen = () => {
          if (session !== this.generation) {
            fail("Deepgram connection canceled.");
            return;
          }
          finished = true;
          clearTimeout(timeout);
          this.pendingConnectionReject = null;
          this.connecting = false;
          this.report("connected", "Deepgram is ready for microphone audio.");
          resolve();
        };
        socket.onerror = () => {
          if (!finished) {
            fail("Could not connect to Deepgram.");
            return;
          }
          if (session !== this.generation) return;
          this.removeSocket(socket);
          this.report("error", "Deepgram connection encountered a network error.");
        };
        socket.onclose = () => {
          if (!finished) {
            fail("Deepgram closed before the connection was established.");
            return;
          }
          if (session !== this.generation) return;
          this.removeSocket(socket);
          this.report("disconnected", "Deepgram disconnected.");
        };
        socket.onmessage = (event: MessageEvent<string>) => {
          if (session !== this.generation) return;
          try {
            const message: unknown = JSON.parse(event.data);
            if (typeof message === "object" && message !== null
              && "type" in message && message.type === "Error") {
              // Avoid reporting provider error descriptions that could contain
              // sensitive user or session data.
              this.removeSocket(socket);
              this.report("error", "Deepgram reported a transcription error.");
              return;
            }
            this.callbacks.onMessage(message);
          } catch {
            this.removeSocket(socket);
            this.report("error", "Deepgram sent an invalid response.");
          }
        };
      });
    } catch (error) {
      if (session === this.generation) {
        this.report("error", error instanceof Error ? error.message : "Deepgram connection failed.");
      }
      throw error;
    } finally {
      clearTimeout(tokenTimeout);
      if (session === this.generation) {
        this.tokenRequest = null;
        this.connecting = false;
      }
    }
  }

  /** Call only with encoded 16-bit little-endian PCM frames, not Int16Array. */
  sendAudio(audio: ArrayBuffer): void {
    if (this.finishingPromise) throw new Error("Deepgram stream is finishing.");
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN || this.status !== "connected") {
      throw new Error("Deepgram is not ready for audio.");
    }
    if (audio.byteLength === 0 || audio.byteLength % 2 !== 0) {
      throw new Error("Audio must contain complete 16-bit PCM samples.");
    }
    if (socket.bufferedAmount + audio.byteLength > MAX_BUFFERED_AUDIO_BYTES) {
      throw new Error("Deepgram connection is too slow; stop audio instead of dropping frames.");
    }
    socket.send(audio);
  }

  /**
   * Ask Deepgram to process buffered audio and send final Results before it
   * closes the stream. Messages continue to flow to onMessage while waiting.
   * A timeout prevents Stop from hanging on a broken network.
   */
  finish(): Promise<void> {
    if (this.finishingPromise) return this.finishingPromise;
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN || this.status !== "connected") {
      this.disconnect();
      return Promise.resolve();
    }

    let resolvePending!: () => void;
    const pending = new Promise<void>((resolve) => { resolvePending = resolve; });
    this.finishingPromise = pending;
    this.finishResolve = resolvePending;
    this.finishTimeout = setTimeout(() => this.disconnect(), STREAM_FINISH_TIMEOUT_MS);
    try {
      // CloseStream tells Deepgram to flush remaining audio before closing.
      // Do NOT close the socket here: the final transcript may arrive later.
      socket.send(JSON.stringify({ type: "CloseStream" }));
    } catch {
      this.disconnect();
    }
    return pending;
  }

  /** Stops both an in-flight connection and an open WebSocket. */
  disconnect(): void {
    this.generation++;
    this.tokenRequest?.abort();
    this.tokenRequest = null;
    this.pendingConnectionReject?.(new Error("Deepgram connection canceled."));
    this.pendingConnectionReject = null;
    this.connecting = false;
    if (this.socket) this.removeSocket(this.socket);
    this.resolveFinishing();
    this.report("disconnected", "Deepgram session stopped.");
  }
}
