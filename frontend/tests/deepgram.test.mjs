import assert from "node:assert/strict";
import { test } from "node:test";
import { DeepgramClient, DEEPGRAM_LISTEN_URL } from "../lib/deepgram.ts";

const tick = () => new Promise((resolve) => setImmediate(resolve));

function mockEnvironment(t, { tokenResponse, delayToken = false } = {}) {
  const sockets = [];
  const fetches = [];
  const statuses = [];
  const messages = [];
  let releaseToken;
  const tokenGate = delayToken ? new Promise((resolve) => { releaseToken = resolve; }) : Promise.resolve();
  class Socket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = 0;
    bufferedAmount = 0;
    sent = [];
    constructor(url, protocols) {
      this.url = url;
      this.protocols = protocols;
      sockets.push(this);
    }
    send(bytes) { this.sent.push(bytes); }
    close() { this.readyState = 3; }
    open() { this.readyState = 1; this.onopen?.(); }
    message(data) { this.onmessage?.({ data: JSON.stringify(data) }); }
    closeFromServer() { this.readyState = 3; this.onclose?.(); }
    error() { this.onerror?.(); }
  }
  const fetchMock = async (url, options) => {
    fetches.push({ url, options });
    await tokenGate;
    return tokenResponse ?? { ok: true, json: async () => ({ access_token: "test-jwt", expires_in: 30 }) };
  };
  for (const [name, value] of Object.entries({ WebSocket: Socket, fetch: fetchMock })) {
    const old = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => old ? Object.defineProperty(globalThis, name, old) : delete globalThis[name]);
  }
  const client = new DeepgramClient({
    onStatus: (status, message) => statuses.push([status, message]),
    onMessage: (message) => messages.push(message),
  });
  t.after(() => client.disconnect());
  return { client, sockets, fetches, statuses, messages, releaseToken };
}

async function connect(env) {
  const connection = env.client.connect();
  await tick();
  const socket = env.sockets.at(-1);
  socket.open();
  await connection;
  return socket;
}

test("requests a fresh token and opens a bearer WebSocket with PCM settings", async (t) => {
  const env = mockEnvironment(t);
  const socket = await connect(env);
  assert.equal(env.fetches[0].url, "http://localhost:8000/deepgram/token");
  assert.equal(env.fetches[0].options.method, "POST");
  assert.equal(env.fetches[0].options.cache, "no-store");
  assert.deepEqual(socket.protocols, ["bearer", "test-jwt"]);
  const config = new URL(socket.url);
  assert.equal(config.origin, "wss://api.deepgram.com");
  assert.equal(config.searchParams.get("model"), "nova-3");
  assert.equal(config.searchParams.get("encoding"), "linear16");
  assert.equal(config.searchParams.get("sample_rate"), "16000");
  assert.equal(config.searchParams.get("channels"), "1");
  assert.equal(config.searchParams.get("interim_results"), "true");
  assert.equal(config.searchParams.get("endpointing"), "300");
  assert.equal(socket.url, DEEPGRAM_LISTEN_URL);
  assert.equal(env.client.currentStatus, "connected");
});

test("accepts PCM bytes only when connected and rejects a slow socket", async (t) => {
  const env = mockEnvironment(t);
  assert.throws(() => env.client.sendAudio(new ArrayBuffer(4)), /not ready/);
  const socket = await connect(env);
  const audio = new ArrayBuffer(3200);
  env.client.sendAudio(audio);
  assert.equal(socket.sent[0], audio);
  assert.throws(() => env.client.sendAudio(new ArrayBuffer(3)), /complete 16-bit/);
  socket.bufferedAmount = 32000;
  assert.throws(() => env.client.sendAudio(audio), /too slow/);
  assert.equal(socket.sent.length, 1);
  env.client.disconnect();
  assert.equal(socket.readyState, 3);
  assert.throws(() => env.client.sendAudio(audio), /not ready/);
});

test("forwards decoded messages and reports server errors without provider details", async (t) => {
  const env = mockEnvironment(t);
  const socket = await connect(env);
  socket.message({ type: "Results", is_final: false, channel: { alternatives: [{ transcript: "Hello" }] } });
  assert.equal(env.messages[0].channel.alternatives[0].transcript, "Hello");
  socket.message({ type: "Error", description: "Sensitive provider details" });
  assert.equal(env.client.currentStatus, "error");
  assert.equal(socket.readyState, 3);
  assert.ok(!env.statuses.at(-1)[1].includes("Sensitive"));
});

test("rejects invalid token response without constructing a socket", async (t) => {
  const env = mockEnvironment(t, { tokenResponse: { ok: true, json: async () => ({ access_token: "" }) } });
  await assert.rejects(env.client.connect(), /invalid Deepgram token response/);
  assert.equal(env.sockets.length, 0);
  assert.equal(env.client.currentStatus, "error");
});

test("handles a non-200 auth response and allows later retry", async (t) => {
  const env = mockEnvironment(t, { tokenResponse: { ok: false } });
  await assert.rejects(env.client.connect(), /Could not obtain temporary/);
  assert.equal(env.sockets.length, 0);
  assert.equal(env.client.currentStatus, "error");
});

test("disconnect during token request prevents a stale socket", async (t) => {
  const env = mockEnvironment(t, { delayToken: true });
  const connection = env.client.connect();
  env.client.disconnect();
  env.releaseToken();
  await assert.rejects(connection, /canceled/);
  assert.equal(env.sockets.length, 0);
  assert.equal(env.client.currentStatus, "disconnected");
});

test("failed WebSocket handshake reports error and can retry with a new token", async (t) => {
  const env = mockEnvironment(t);
  const first = env.client.connect();
  await tick();
  env.sockets[0].error();
  await assert.rejects(first, /Could not connect to Deepgram/);
  assert.equal(env.client.currentStatus, "error");
  const second = await connect(env);
  assert.equal(second.readyState, 1);
  assert.equal(env.fetches.length, 2);
});

test("remote disconnect resets status and permits a fresh connection", async (t) => {
  const env = mockEnvironment(t);
  const first = await connect(env);
  first.closeFromServer();
  assert.equal(env.client.currentStatus, "disconnected");
  await connect(env);
  assert.equal(env.fetches.length, 2);
});


test("disconnect during WebSocket handshake immediately rejects the pending connection", async (t) => {
  const env = mockEnvironment(t);
  const connection = env.client.connect();
  await tick();
  const socket = env.sockets.at(-1);
  env.client.disconnect();
  await assert.rejects(connection, /canceled/);
  assert.equal(socket.readyState, 3);
  assert.equal(env.client.currentStatus, "disconnected");
});

test("malformed Deepgram data closes the connection without exposing raw payload", async (t) => {
  const env = mockEnvironment(t);
  const socket = await connect(env);
  socket.onmessage({ data: "not-json" });
  assert.equal(env.client.currentStatus, "error");
  assert.equal(socket.readyState, 3);
});


test("network failure after opening reports an error and releases the socket", async (t) => {
  const env = mockEnvironment(t);
  const socket = await connect(env);
  socket.error();
  assert.equal(env.client.currentStatus, "error");
  assert.equal(socket.readyState, 3);
});

test("graceful finish waits for Deepgram's final Results before closing", async (t) => {
  const env = mockEnvironment(t);
  const socket = await connect(env);
  const finishing = env.client.finish();
  assert.deepEqual(socket.sent, ['{"type":"CloseStream"}']);
  assert.equal(socket.readyState, 1);
  const final = { type: "Results", is_final: true, speech_final: true,
    channel: { alternatives: [{ transcript: "Last few words." }] } };
  socket.message(final);
  assert.deepEqual(env.messages.at(-1), final);
  socket.closeFromServer();
  await finishing;
  assert.equal(env.client.currentStatus, "disconnected");
});

test("graceful finish is idempotent and audio cannot be sent afterward", async (t) => {
  const env = mockEnvironment(t);
  const socket = await connect(env);
  const first = env.client.finish();
  const second = env.client.finish();
  assert.equal(first, second);
  assert.equal(socket.sent.length, 1);
  assert.throws(() => env.client.sendAudio(new ArrayBuffer(3200)), /finishing/);
  env.client.disconnect();
  await first;
  assert.equal(socket.readyState, 3);
});

test("graceful finish times out if the provider never closes", async (t) => {
  const env = mockEnvironment(t);
  const socket = await connect(env);
  await env.client.finish();
  assert.equal(socket.readyState, 3);
  assert.equal(env.client.currentStatus, "disconnected");
});
