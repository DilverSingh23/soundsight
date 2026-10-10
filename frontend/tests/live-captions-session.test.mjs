import assert from "node:assert/strict";
import { test } from "node:test";
import { startLiveCaptionsSession } from "../lib/live-captions-session.ts";

function setup({ authFails = false, sendFails = false } = {}) {
  let transportCallbacks, captureCallbacks, resolveFinish;
  const statuses = [], transcription = [], messages = [], sent = [], observedAudio = [];
  let connects = 0, stopped = 0, disconnected = 0, ended = 0, finishes = 0;
  const transport = {
    async connect() {
      connects++;
      if (authFails) {
        transportCallbacks.onStatus("error", "Authentication failed");
        throw new Error("No key");
      }
      transportCallbacks.onStatus("connected", "Ready");
    },
    sendAudio(audio) { if (sendFails) throw new Error("Slow socket"); sent.push(audio); },
    disconnect() { disconnected++; transportCallbacks.onStatus("disconnected", "Stopped"); },
    finish() { finishes++; return new Promise((resolve) => { resolveFinish = resolve; }); },
  };
  const stop = startLiveCaptionsSession({
    onStatus(status) { statuses.push(status); },
    onStats() {},
    onTranscriptionStatus(status) { transcription.push(status); },
    onTranscript(message) { messages.push(message); },
    onAudio(audio) { observedAudio.push(audio); },
    onEnded() { ended++; },
  }, (callbacks) => { transportCallbacks = callbacks; return transport; },
  (callbacks) => { captureCallbacks = callbacks; return () => { stopped++; }; });
  return { stop, statuses, transcription, messages, sent, observedAudio,
    capture: () => captureCallbacks, transport: () => transportCallbacks,
    complete: () => resolveFinish(), counts: () => ({ connects, stopped, disconnected, ended, finishes }) };
}

test("one capture connects transcription before sending identical PCM to its second destination", async () => {
  const env = setup();
  await env.capture().beforeCapture();
  env.capture().onStatus("Listening", "Ready");
  const audio = new ArrayBuffer(3200);
  env.capture().onAudio(audio);
  assert.equal(env.sent[0], audio);
  assert.equal(env.observedAudio[0], audio);
  assert.equal(env.counts().connects, 1);
  env.stop();
});

test("unavailable Deepgram leaves environmental capture running", async () => {
  const env = setup({ authFails: true });
  await env.capture().beforeCapture();
  env.capture().onStatus("Listening", "Ready");
  env.capture().onAudio(new ArrayBuffer(3200));
  assert.equal(env.statuses.at(-1), "Listening");
  assert.equal(env.transcription.at(-1), "error");
  assert.equal(env.counts().stopped, 0);
  assert.equal(env.sent.length, 0);
  env.stop();
});

test("transcription delivery failure leaves sound awareness active", async () => {
  const env = setup({ sendFails: true });
  await env.capture().beforeCapture();
  env.capture().onStatus("Listening", "Ready");
  env.capture().onAudio(new ArrayBuffer(3200));
  assert.equal(env.transcription.at(-1), "error");
  assert.equal(env.counts().stopped, 0);
  assert.equal(env.statuses.at(-1), "Listening");
  env.stop();
});

test("Stop releases capture immediately and accepts trailing final words before closing", async () => {
  const env = setup();
  await env.capture().beforeCapture();
  env.capture().onStatus("Listening", "Ready");
  env.stop(true);
  assert.equal(env.counts().stopped, 1);
  assert.equal(env.counts().finishes, 1);
  assert.equal(env.statuses.at(-1), "Finishing");
  env.transport().onMessage({ final: "last words" });
  assert.equal(env.messages.length, 1);
  env.stop(true);
  assert.equal(env.counts().finishes, 1);
  env.complete();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(env.counts().ended, 1);
  assert.equal(env.counts().stopped, 1);
  assert.equal(env.statuses.at(-1), "Stopped");
  env.transport().onMessage({ stale: true });
  assert.equal(env.messages.length, 1);
});

test("backend failure closes transcription and ignores old callbacks", async () => {
  const env = setup();
  await env.capture().beforeCapture();
  env.capture().onStatus("Error", "Backend lost");
  assert.equal(env.counts().ended, 1);
  assert.equal(env.counts().disconnected, 1);
  env.transport().onMessage({ stale: true });
  env.capture().onAudio(new ArrayBuffer(3200));
  assert.equal(env.sent.length, 0);
  assert.equal(env.messages.length, 0);
  assert.equal(env.statuses.at(-1), "Error");
});

test("immediate teardown during finishing disconnects without waiting", async () => {
  const env = setup();
  await env.capture().beforeCapture();
  env.capture().onStatus("Listening", "Ready");
  env.stop(true);
  env.stop();
  assert.equal(env.counts().ended, 1);
  assert.equal(env.counts().disconnected, 1);
  env.complete();
});
