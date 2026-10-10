import assert from "node:assert/strict";
import { test } from "node:test";
import { startDeepgramMicrophone } from "../lib/deepgram-microphone.ts";

const tick = () => new Promise((resolve) => setImmediate(resolve));

function setup({ delayedConnection = false, delayedPermission = false, captureError = null } = {}) {
  const statuses = [];
  const sent = [];
  let connectCalls = 0;
  let disconnectCalls = 0;
  let recorderStarts = 0;
  let recorderStops = 0;
  let onFrame;
  let grantConnection;
  let grantPermission;
  const connectionGate = delayedConnection
    ? new Promise((resolve) => { grantConnection = resolve; })
    : Promise.resolve();
  const permissionGate = delayedPermission
    ? new Promise((resolve) => { grantPermission = resolve; })
    : Promise.resolve();
  let connected = false;
  const transport = {
    async connect() { connectCalls++; await connectionGate; connected = true; },
    sendAudio(audio) {
      if (!connected) throw new Error("not connected");
      sent.push(audio);
    },
    disconnect() { disconnectCalls++; connected = false; },
  };
  const capture = async (callback) => {
    recorderStarts++;
    onFrame = callback;
    await permissionGate;
    if (captureError) throw captureError;
    return async () => { recorderStops++; };
  };
  const start = () => startDeepgramMicrophone(transport, {
    onStatus(status, message) { statuses.push([status, message]); },
  }, capture);
  return {
    start, transport, sent, statuses,
    frame: (values = new Int16Array(1600)) => onFrame(values),
    grantConnection: () => grantConnection?.(),
    grantPermission: () => grantPermission?.(),
    get connectCalls() { return connectCalls; },
    get disconnectCalls() { return disconnectCalls; },
    get recorderStarts() { return recorderStarts; },
    get recorderStops() { return recorderStops; },
  };
}

test("connects before capturing; sends exact signed little-endian PCM", async () => {
  const env = setup({ delayedConnection: true });
  const stop = env.start();
  assert.equal(env.recorderStarts, 0);
  assert.equal(env.statuses.at(-1)[0], "connecting");
  env.grantConnection();
  await tick();
  assert.equal(env.recorderStarts, 1);
  assert.equal(env.statuses.at(-1)[0], "listening");
  env.frame(new Int16Array([16384, -16384, 32767, -32768]));
  assert.deepEqual([...new Uint8Array(env.sent[0])], [0, 64, 0, 192, 255, 127, 0, 128]);
  stop();
  await tick();
  assert.equal(env.recorderStops, 1);
  assert.equal(env.disconnectCalls, 1);
  assert.equal(env.statuses.at(-1)[0], "stopped");
});

test("stop during token/connection prevents any microphone access", async () => {
  const env = setup({ delayedConnection: true });
  const stop = env.start();
  stop();
  env.grantConnection();
  await tick();
  assert.equal(env.recorderStarts, 0);
  assert.equal(env.sent.length, 0);
  assert.equal(env.statuses.at(-1)[0], "stopped");
});

test("stop during permission prompt releases late granted microphone", async () => {
  const env = setup({ delayedPermission: true });
  const stop = env.start();
  await tick();
  assert.equal(env.statuses.at(-1)[0], "requesting-permission");
  stop();
  env.grantPermission();
  await tick();
  assert.equal(env.recorderStops, 1);
  assert.equal(env.statuses.at(-1)[0], "stopped");
});

test("connection failure never requests microphone", async () => {
  const env = setup();
  env.transport.connect = async () => { throw new Error("sensitive token"); };
  env.start();
  await tick();
  assert.equal(env.recorderStarts, 0);
  assert.equal(env.statuses.at(-1)[0], "error");
  assert.ok(!env.statuses.at(-1)[1].includes("sensitive"));
});

test("permission denial cleans up connection with clear error", async () => {
  const env = setup({ captureError: Object.assign(new Error("denied"), { name: "NotAllowedError" }) });
  env.start();
  await tick();
  assert.equal(env.statuses.at(-1)[0], "error");
  assert.match(env.statuses.at(-1)[1], /denied/);
  assert.equal(env.disconnectCalls, 1);
});

test("audio send failure stops instead of silently dropping frames", async () => {
  const env = setup();
  const stop = env.start();
  await tick();
  env.transport.sendAudio = () => { throw new Error("backpressure"); };
  env.frame();
  await tick();
  assert.equal(env.statuses.at(-1)[0], "error");
  assert.equal(env.recorderStops, 1);
  assert.equal(env.disconnectCalls, 1);
  env.frame();
  assert.equal(env.statuses.filter(([s]) => s === "error").length, 1);
  stop();
});

test("late frames after stop are ignored", async () => {
  const env = setup();
  const stop = env.start();
  await tick();
  stop();
  env.frame();
  assert.equal(env.sent.length, 0);
});

test("permission error is reported before the socket disconnect callback", async () => {
  const order = [];
  const transport = {
    async connect() {},
    sendAudio() {},
    disconnect() { order.push("disconnect"); },
  };
  startDeepgramMicrophone(transport, {
    onStatus(status) { if (status === "error") order.push("error"); },
  }, async () => { throw Object.assign(new Error("denied"), { name: "NotAllowedError" }); });
  await tick();
  assert.deepEqual(order, ["error", "disconnect"]);
});
