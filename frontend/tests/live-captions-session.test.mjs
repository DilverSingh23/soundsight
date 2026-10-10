import assert from "node:assert/strict";
import { test } from "node:test";
import { startLiveCaptionsSession } from "../lib/live-captions-session.ts";

function setup() {
  const connection = [];
  const microphone = [];
  const messages = [];
  let ended = 0;
  let disconnected = 0;
  let micStopped = 0;
  let finalizeCalls = 0;
  let resolveFinishing;
  let transportCallbacks;
  let microphoneCallbacks;
  const transport = {
    async connect() {},
    sendAudio() {},
    finish() {
      finalizeCalls++;
      return new Promise((resolve) => { resolveFinishing = resolve; });
    },
    disconnect() {
      disconnected++;
      transportCallbacks.onStatus("disconnected", "Internal close");
    },
  };
  const stop = startLiveCaptionsSession({
    onConnectionStatus: (...args) => connection.push(args),
    onMicrophoneStatus: (...args) => microphone.push(args),
    onMessage: (message) => messages.push(message),
    onEnded: () => ended++,
  }, (cb) => {
    transportCallbacks = cb;
    return transport;
  }, (client, cb) => {
    assert.equal(client, transport);
    microphoneCallbacks = cb;
    cb.onStatus("connecting", "Preparing Deepgram");
    let stopped = false;
    return (keepConnectionOpen = false) => {
      if (stopped) return;
      stopped = true;
      micStopped++;
      if (!keepConnectionOpen) client.disconnect();
      cb.onStatus("stopped", "Internal stop");
    };
  });
  return {
    connection, microphone, messages, stop, transportCallbacks, microphoneCallbacks,
    get ended() { return ended; },
    get disconnected() { return disconnected; },
    get micStopped() { return micStopped; },
    get finalizeCalls() { return finalizeCalls; },
    resolveFinishing: () => resolveFinishing?.(),
  };
}

test("transports partial and finalized messages while connected", () => {
  const env = setup();
  env.transportCallbacks.onStatus("authenticating", "Getting token");
  env.transportCallbacks.onStatus("connected", "Ready");
  env.microphoneCallbacks.onStatus("listening", "Recording");
  const partial = { type: "Results", is_final: false, channel: { alternatives: [{ transcript: "Hello" }] } };
  const final = { ...partial, is_final: true };
  env.transportCallbacks.onMessage(partial);
  env.transportCallbacks.onMessage(final);
  assert.deepEqual(env.messages, [partial, final]);
  assert.deepEqual(env.microphone.map(([s]) => s), ["connecting", "listening"]);
  assert.deepEqual(env.connection.map(([s]) => s), ["authenticating", "connected"]);
  env.stop();
  assert.equal(env.disconnected, 1);
  assert.equal(env.micStopped, 1);
});

test("stopping releases socket and mic exactly once, ignoring stale callbacks", () => {
  const env = setup();
  env.stop();
  env.stop();
  env.transportCallbacks.onMessage({ type: "Results" });
  env.transportCallbacks.onStatus("connected", "Late open");
  env.microphoneCallbacks.onStatus("listening", "Late permission");
  assert.equal(env.disconnected, 1);
  assert.equal(env.micStopped, 1);
  assert.equal(env.ended, 1);
  assert.equal(env.messages.length, 0);
  assert.deepEqual(env.microphone.map(([s]) => s), ["connecting", "stopped"]);
  assert.deepEqual(env.connection.map(([s]) => s), ["disconnected"]);
});

test("socket closes while recording: microphone stops and UI receives disconnect", () => {
  const env = setup();
  env.microphoneCallbacks.onStatus("listening", "Recording");
  env.transportCallbacks.onStatus("disconnected", "Deepgram closed");
  assert.equal(env.micStopped, 1);
  assert.equal(env.ended, 1);
  assert.deepEqual(env.connection.at(-1), ["disconnected", "Deepgram closed"]);
  assert.equal(env.microphone.at(-1)[0], "stopped");
});

test("socket failure stops mic, reports error, and does not leak raw provider details", () => {
  const env = setup();
  env.microphoneCallbacks.onStatus("listening", "Recording");
  env.transportCallbacks.onStatus("error", "Connection failed");
  assert.equal(env.micStopped, 1);
  assert.equal(env.microphone.at(-1)[0], "error");
  assert.match(env.microphone.at(-1)[1], /connection failed/i);
  assert.equal(env.ended, 1);
});

test("microphone permission denial remains the visible error after disconnect", () => {
  const env = setup();
  env.microphoneCallbacks.onStatus("error", "Microphone access was denied.");
  assert.equal(env.micStopped, 1);
  assert.equal(env.microphone.at(-1)[0], "error");
  assert.match(env.microphone.at(-1)[1], /denied/);
  assert.equal(env.connection.at(-1)[0], "disconnected");
});

test("finished sessions do not handle late frames or messages", () => {
  const env = setup();
  env.transportCallbacks.onStatus("disconnected", "Remote close");
  env.transportCallbacks.onMessage({ transcript: "should be ignored" });
  env.microphoneCallbacks.onStatus("error", "Late failure");
  assert.equal(env.messages.length, 0);
  assert.equal(env.microphone.at(-1)[0], "stopped");
  assert.equal(env.ended, 1);
});

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("Stop during listening waits for trailing final result before ending", async () => {
  const env = setup();
  env.microphoneCallbacks.onStatus("listening", "Recording");
  env.stop(true);
  assert.equal(env.micStopped, 1);
  assert.equal(env.disconnected, 0);
  assert.equal(env.finalizeCalls, 1);
  assert.equal(env.ended, 0);
  assert.equal(env.microphone.at(-1)[0], "finishing");
  // Deepgram may still send finalized words before its CloseStream closes.
  const final = { type: "Results", is_final: true, channel: { alternatives: [{ transcript: "Goodbye." }] } };
  env.transportCallbacks.onMessage(final);
  assert.deepEqual(env.messages, [final]);
  env.transportCallbacks.onStatus("disconnected", "Provider finished");
  env.resolveFinishing();
  await tick();
  assert.equal(env.ended, 1);
  assert.equal(env.microphone.at(-1)[0], "stopped");
  env.transportCallbacks.onMessage({ type: "Results" });
  assert.equal(env.messages.length, 1);
});

test("Stop before microphone is listening remains immediate", () => {
  const env = setup();
  env.stop(true);
  assert.equal(env.finalizeCalls, 0);
  assert.equal(env.ended, 1);
  assert.equal(env.disconnected, 1);
});

test("while finishing, repeated Stop does not resend CloseStream", () => {
  const env = setup();
  env.microphoneCallbacks.onStatus("listening", "Recording");
  env.stop(true);
  env.stop(true);
  assert.equal(env.finalizeCalls, 1);
  assert.equal(env.micStopped, 1);
  env.resolveFinishing();
});

test("page unmount during finalization closes the socket immediately", () => {
  const env = setup();
  env.microphoneCallbacks.onStatus("listening", "Recording");
  env.stop(true);
  assert.equal(env.ended, 0);
  env.stop(); // Route cleanup, not another user Stop click.
  assert.equal(env.ended, 1);
  assert.equal(env.disconnected, 1);
  env.transportCallbacks.onMessage({ type: "Results" });
  assert.equal(env.messages.length, 0);
  env.resolveFinishing();
});
