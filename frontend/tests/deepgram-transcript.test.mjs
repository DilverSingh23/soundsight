import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyDeepgramMessage,
  emptyDeepgramTranscript,
  getFinalTranscript,
  getVisibleTranscript,
} from "../lib/deepgram-transcript.ts";

const result = (text, is_final, start, speech_final = false) => ({
  type: "Results",
  is_final,
  speech_final,
  start,
  channel: { alternatives: [{ transcript: text }] },
});

test("interim captions replace the previous candidate without becoming permanent", () => {
  let state = emptyDeepgramTranscript();
  state = applyDeepgramMessage(state, result("Hey can", false, 0));
  state = applyDeepgramMessage(state, result("Hey can you", false, 0));
  assert.equal(getFinalTranscript(state), "");
  assert.equal(getVisibleTranscript(state), "Hey can you");
  state = applyDeepgramMessage(state, result("Hey can you", true, 0));
  assert.equal(getVisibleTranscript(state), "Hey can you");
  assert.equal(state.interimText, "");
});

test("multiple final segments remain visible before speech_final", () => {
  let state = emptyDeepgramTranscript();
  state = applyDeepgramMessage(state, result("I need", true, 0));
  state = applyDeepgramMessage(state, result("some help", true, 1.4));
  assert.equal(getFinalTranscript(state), "I need some help");
  assert.deepEqual(state.completedUtterances, []);
  state = applyDeepgramMessage(state, result("right now.", true, 2.2, true));
  assert.deepEqual(state.completedUtterances, ["I need some help right now."]);
  assert.equal(getVisibleTranscript(state), "I need some help right now.");
});

test("interim words are combined with final words but never double-counted", () => {
  let state = applyDeepgramMessage(emptyDeepgramTranscript(), result("Good morning", true, 0));
  state = applyDeepgramMessage(state, result("how are you", false, 1.2));
  assert.equal(getVisibleTranscript(state), "Good morning how are you");
  state = applyDeepgramMessage(state, result("how are you?", true, 1.2, true));
  assert.equal(getVisibleTranscript(state), "Good morning how are you?");
});

test("duplicate final events at the same audio offset are ignored", () => {
  let state = applyDeepgramMessage(emptyDeepgramTranscript(), result("Hello", true, 0));
  state = applyDeepgramMessage(state, result("Hello", true, 0));
  assert.equal(getFinalTranscript(state), "Hello");
  state = applyDeepgramMessage(state, result("world.", true, 0.6, true));
  state = applyDeepgramMessage(state, result("world.", true, 0.6, true));
  assert.deepEqual(state.completedUtterances, ["Hello world."]);
});

test("identical words spoken again at a new time are not incorrectly discarded", () => {
  let state = applyDeepgramMessage(emptyDeepgramTranscript(), result("Hello.", true, 0, true));
  state = applyDeepgramMessage(state, result("Hello.", true, 2.5, true));
  assert.deepEqual(state.completedUtterances, ["Hello.", "Hello."]);
});

test("empty final messages can finish an utterance without erasing prior chunks", () => {
  let state = applyDeepgramMessage(emptyDeepgramTranscript(), result("Please wait", true, 0));
  state = applyDeepgramMessage(state, result("", true, 2, true));
  assert.deepEqual(state.completedUtterances, ["Please wait"]);
  assert.equal(getVisibleTranscript(state), "Please wait");
});

test("interim empty text clears a stale interim candidate", () => {
  let state = applyDeepgramMessage(emptyDeepgramTranscript(), result("unfinished", false, 0));
  state = applyDeepgramMessage(state, result("   ", false, 0));
  assert.equal(getVisibleTranscript(state), "");
});

test("metadata and malformed messages do not corrupt transcript state", () => {
  const state = applyDeepgramMessage(emptyDeepgramTranscript(), result("Ready", true, 0));
  const garbage = [null, {}, { type: "Metadata" }, { type: "SpeechStarted" },
    { type: "Results", is_final: "true", channel: { alternatives: [{ transcript: "oops" }] } },
    { type: "Results", is_final: true, channel: { alternatives: [{ transcript: 123 }] } },
    { type: "Results", is_final: true, channel: { alternatives: [] } },
    { type: "Results", is_final: true, channel: null }, []];
  for (const message of garbage) assert.equal(applyDeepgramMessage(state, message), state);
  assert.equal(getFinalTranscript(state), "Ready");
});

test("reducer does not mutate earlier transcript states", () => {
  const original = emptyDeepgramTranscript();
  const next = applyDeepgramMessage(original, result("Hello", true, 0));
  assert.equal(original.currentFinalSegments.length, 0);
  assert.equal(original.seenFinalStartsMs.length, 0);
  assert.equal(next.currentFinalSegments.length, 1);
});
