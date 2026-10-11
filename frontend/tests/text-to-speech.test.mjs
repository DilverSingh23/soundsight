import assert from "node:assert/strict";
import { test } from "node:test";
import { speakWithElevenLabs, VOICE_REQUEST_TIMEOUT_MS } from "../lib/text-to-speech.ts";

const tick = () => new Promise((resolve) => setImmediate(resolve));
function setup(t, response) {
  const errors = [], starts = [], ends = [], audios = [], revoked = [], timers = [];
  let request;
  class AudioMock {
    constructor(url) { this.url = url; audios.push(this); }
    async play() {}
    pause() { this.paused = true; }
    removeAttribute() {}
    load() {}
  }
  const values = {
    window: { location: { protocol: "http:" } },
    Audio: AudioMock,
    fetch: async (_url, options) => { request = options; return response; },
    setTimeout: (callback, milliseconds) => { timers.push({ callback, milliseconds }); return timers.length; },
    clearTimeout: () => {},
  };
  for (const [key, value] of Object.entries(values)) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => old ? Object.defineProperty(globalThis, key, old) : delete globalThis[key]);
  }
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
  URL.createObjectURL = () => "blob:test";
  URL.revokeObjectURL = (url) => revoked.push(url);
  t.after(() => { URL.createObjectURL = create; URL.revokeObjectURL = revoke; });
  const stop = speakWithElevenLabs("hello", 1, {
    onError: (message) => errors.push(message), onStart: () => starts.push(true), onEnd: () => ends.push(true),
  });
  t.after(stop);
  return { errors, starts, ends, audios, revoked, timers, stop, request: () => request };
}

test("downloaded voice audio plays and releases its URL on completion", async (t) => {
  const env = setup(t, { ok: true, blob: async () => new Blob(["audio"]) });
  await tick();
  assert.equal(env.starts.length, 1);
  env.audios[0].onended();
  assert.equal(env.ends.length, 1);
  assert.deepEqual(env.revoked, ["blob:test"]);
});

test("an interrupted response body reports one failure and permits fallback", async (t) => {
  const env = setup(t, { ok: true, blob: async () => { throw new Error("stream lost"); } });
  await tick();
  assert.equal(env.errors.length, 1);
  assert.equal(env.starts.length, 0);
});

test("timeout aborts a stuck request without a second error callback", async (t) => {
  const env = setup(t, new Promise(() => {}));
  assert.equal(env.timers[0].milliseconds, VOICE_REQUEST_TIMEOUT_MS);
  env.timers[0].callback();
  env.timers[0].callback();
  assert.equal(env.request().signal.aborted, true);
  assert.equal(env.errors.length, 1);
});

test("Stop during download ignores late audio and does not trigger fallback", async (t) => {
  let resolve;
  const body = new Promise((done) => { resolve = done; });
  const env = setup(t, { ok: true, blob: () => body });
  await tick();
  env.stop();
  resolve(new Blob(["audio"]));
  await tick();
  assert.equal(env.audios.length, 0);
  assert.equal(env.errors.length, 0);
});

test("empty audio fails before attempting playback", async (t) => {
  const env = setup(t, { ok: true, blob: async () => new Blob() });
  await tick();
  assert.equal(env.errors.length, 1);
  assert.equal(env.audios.length, 0);
});
