import assert from "node:assert/strict";
import { test } from "node:test";
import { backendAccessHeaders, backendSocketProtocols, getBackendAccessCode, saveBackendAccessCode } from "../lib/backend-access.ts";

function browser(t, storageBlocked = false) {
  const old = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map();
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    sessionStorage: {
      getItem(key) { if (storageBlocked) throw Error("blocked"); return values.get(key) ?? null; },
      setItem(key, value) { if (storageBlocked) throw Error("blocked"); values.set(key, value); },
      removeItem(key) { if (storageBlocked) throw Error("blocked"); values.delete(key); },
    },
  } });
  saveBackendAccessCode("");
  t.after(() => {
    saveBackendAccessCode("");
    if (old) Object.defineProperty(globalThis, "window", old); else delete globalThis.window;
  });
}

test("an empty local code adds no authentication credentials", (t) => {
  browser(t);
  assert.deepEqual(backendAccessHeaders(), {});
  assert.deepEqual(backendSocketProtocols(), []);
});

test("saved demo code travels in a header or subprotocol and can be cleared", (t) => {
  browser(t);
  const code = "a".repeat(64);
  saveBackendAccessCode(code);
  assert.equal(getBackendAccessCode(), code);
  assert.deepEqual(backendAccessHeaders(), { Authorization: `Bearer ${code}` });
  assert.deepEqual(backendSocketProtocols(), ["soundsight", `access.${code}`]);
  saveBackendAccessCode("");
  assert.deepEqual(backendAccessHeaders(), {});
});

test("blocked session storage still permits temporary in-memory access", (t) => {
  browser(t, true);
  const code = "b".repeat(64);
  saveBackendAccessCode(code);
  assert.equal(getBackendAccessCode(), code);
  assert.deepEqual(backendAccessHeaders(), { Authorization: `Bearer ${code}` });
});
