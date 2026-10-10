import assert from "node:assert/strict";
import { test } from "node:test";
import { startMicrophoneStream, encodePCMFrame } from "../lib/microphone-stream.ts";

const tick = () => new Promise((resolve) => setImmediate(resolve));

function setup(t, pending = false, extraCallbacks = {}) {
  const statuses = [];
  const stats = [];
  const classifications = [];
  const classificationStatuses = [];
  const soundEvents = [];
  const track = { stopped: false, onended: null, stop() { this.stopped = true; } };
  const sockets = [];
  const contexts = [];
  const nodes = [];
  let grant;
  const permission = pending ? new Promise((resolve) => { grant = resolve; }) : Promise.resolve();
  const capture = {
    async startCapture(onFrame) {
      await permission;
      const context = { state: "running" };
      contexts.push(context);
      nodes.push({ send: onFrame });
      return async () => { track.stop(); context.state = "closed"; };
    },
  };
  class Socket {
    static OPEN = 1;
    readyState = 0;
    bufferedAmount = 0;
    sent = [];
    constructor() { sockets.push(this); }
    send(data) { this.sent.push(data); }
    close() { this.readyState = 3; }
  }
  for (const [name, value] of Object.entries({ navigator: { mediaDevices: { getUserMedia() {} } }, window: { AudioWorkletNode: class {} }, WebSocket: Socket })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => { if (previous) Object.defineProperty(globalThis, name, previous); else delete globalThis[name]; });
  }
  const stop = startMicrophoneStream({ onStatus: (status) => statuses.push(status), onStats: (value) => stats.push(value), onClassification: (value) => classifications.push(value), onClassificationStatus: (value) => classificationStatuses.push(value), onSoundEvent: (value) => soundEvents.push(value), ...extraCallbacks }, async () => capture);
  t.after(stop);
  return { stop, track, sockets, contexts, nodes, statuses, stats, classifications, classificationStatuses, soundEvents, grant: () => grant() };
}

async function connect(env) {
  await tick();
  const socket = env.sockets[0];
  socket.readyState = 1;
  socket.onopen();
  assert.deepEqual(JSON.parse(socket.sent[0]), { type: "start", encoding: "pcm_s16le", sample_rate: 16000, channels: 1 });
  socket.onmessage({ data: '{"type":"ready"}' });
  await tick();
  return socket;
}

test("live capture sends audio after ready and stops all resources", async (t) => {
  const env = setup(t);
  const socket = await connect(env);
  assert.equal(env.statuses.at(-1), "Listening");
  env.nodes[0].send(new Int16Array(1600).fill(16384));
  assert.equal(socket.sent[1].byteLength, 3200);
  assert.equal(new DataView(socket.sent[1]).getInt16(0, true), 16384);
  socket.onmessage({ data: '{"type":"audio_stats","chunks":5,"bytes":16000,"duration_seconds":0.5,"rms":0.1,"peak":0.5}' });
  assert.equal(env.stats[0].bytes, 16000);
  env.stop();
  assert.equal(env.track.stopped, true);
  assert.equal(env.contexts[0].state, "closed");
  assert.equal(socket.readyState, 3);

});

test("Stop during permission releases a stream granted later", async (t) => {
  const env = setup(t, true);
  const socket = await connect(env);
  env.stop();
  env.grant();
  await tick();
  assert.equal(env.track.stopped, true);
  assert.equal(socket.readyState, 3);
  assert.equal(env.contexts[0].state, "closed");
});

test("backend loss stops microphone and allows a new session", async (t) => {
  const env = setup(t);
  const socket = await connect(env);
  socket.onclose();
  assert.equal(env.statuses.at(-1), "Error");
  assert.equal(env.track.stopped, true);
  assert.equal(env.contexts[0].state, "closed");
  const next = setup(t);
  await connect(next);
  assert.equal(next.statuses.at(-1), "Listening");
});

test("slow connection stops instead of accumulating delayed audio", async (t) => {
  const env = setup(t);
  const socket = await connect(env);
  socket.bufferedAmount = 64001;
  env.nodes[0].send(new Int16Array(1600));
  assert.equal(env.statuses.at(-1), "Error");
  assert.equal(env.track.stopped, true);
  assert.equal(socket.sent.length, 1);
});


test("PCM serialization preserves signed samples in little-endian order", () => {
  const bytes = new Uint8Array(encodePCMFrame(new Int16Array([0, 32767, -32768, -1])));
  assert.deepEqual([...bytes], [0, 0, 255, 127, 0, 128, 255, 255]);
});

test("classification diagnostics and model failures preserve microphone streaming", async (t) => {
  const env = setup(t);
  const socket = await connect(env);
  const result = { type: "classification", window_start: 0, window_end: 0.975, inference_ms: 20, results: [{ category: "speech", subtype: "general", score: 0.8, raw_class: "Speech" }] };
  socket.onmessage({ data: JSON.stringify(result) });
  socket.onmessage({ data: JSON.stringify({ type: "classification_status", state: "error", message: "Classification stopped" }) });
  assert.deepEqual(env.classifications, [result]);
  assert.equal(env.classificationStatuses[0].state, "error");
  env.nodes[0].send(new Int16Array(1600));
  assert.equal(socket.sent[1].byteLength, 3200);
  assert.equal(env.statuses.at(-1), "Listening");
  assert.equal(env.track.stopped, false);
});

test("approved sound events reach the listener while audio keeps streaming", async (t) => {
  const env = setup(t);
  const socket = await connect(env);
  const event = { type: "sound_event", id: "test-event", category: "dog", subtype: "bark", label: "Possible dog barking", score: 0.8, audio_time: 0.975, severity: "ambient" };
  socket.onmessage({ data: JSON.stringify(event) });
  assert.deepEqual(env.soundEvents, [event]);
  env.nodes[0].send(new Int16Array(1600));
  assert.equal(socket.sent[1].byteLength, 3200);
  assert.equal(env.statuses.at(-1), "Listening");
});

test("shared capture waits for transcription setup and forwards the identical PCM buffer", async (t) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const forwarded = [];
  const env = setup(t, false, { beforeCapture: () => gate, onAudio: (audio) => forwarded.push(audio) });
  const socket = await connect(env);
  assert.equal(env.nodes.length, 0);
  release();
  await tick();
  assert.equal(env.nodes.length, 1);
  env.nodes[0].send(new Int16Array(1600).fill(123));
  assert.equal(forwarded[0], socket.sent[1]);
  assert.equal(new DataView(forwarded[0]).getInt16(0, true), 123);
});

test("Stop while waiting for transcription does not start a late microphone capture", async (t) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const env = setup(t, false, { beforeCapture: () => gate });
  await connect(env);
  env.stop();
  release();
  await tick();
  assert.equal(env.nodes.length, 0);
});
