import assert from "node:assert/strict";
import { test } from "node:test";
import { startMicrophoneStream, encodePCMFrame } from "../lib/microphone-stream.ts";

const tick = () => new Promise((resolve) => setImmediate(resolve));

function setup(t, pending = false) {
  const statuses = [];
  const stats = [];
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
  const stop = startMicrophoneStream({ onStatus: (status) => statuses.push(status), onStats: (value) => stats.push(value) }, async () => capture);
  t.after(stop);
  return { stop, track, sockets, contexts, nodes, statuses, stats, grant: () => grant() };
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
