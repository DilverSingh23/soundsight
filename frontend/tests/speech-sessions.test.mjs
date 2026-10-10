import assert from "node:assert/strict";
import { test } from "node:test";
import { applySpeechMessage, expireSpeechSessions, closeSpeechSessions } from "../lib/speech-sessions.ts";
import { getFinalTranscript } from "../lib/deepgram-transcript.ts";

let nextId = 0;
const apply = (sessions, incoming) => applySpeechMessage(sessions, incoming, () => `session-${++nextId}`, "2026-10-10T12:00:00Z");
const result = (text, start, duration = 1, final = true, speechFinal = true) => ({
  type: "Results", start, duration, is_final: final, speech_final: speechFinal,
  channel: { alternatives: [{ transcript: text }] },
});

test("recognized words create one session; interim replacements do not duplicate text", () => {
  let sessions = apply([], result("Hey", 0, 1, false, false));
  const id = sessions[0].id;
  sessions = apply(sessions, result("Hey Alex", 0, 1, false, false));
  sessions = apply(sessions, result("Hey Alex, I have a question.", 0));
  sessions = apply(sessions, result("Hey Alex, I have a question.", 0));
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].id, id);
  assert.equal(getFinalTranscript(sessions[0].transcript), "Hey Alex, I have a question.");
});

test("short pauses and separate utterances extend one conversation while opening preview stays fixed", () => {
  let sessions = apply([], result("Hey Alex", 0));
  sessions = apply(sessions, result("I have a question", 3));
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].preview, "Hey Alex");
  assert.equal(getFinalTranscript(sessions[0].transcript), "Hey Alex I have a question");
});

test("five seconds without recognized speech ends a session and later words start another", () => {
  let sessions = apply([], result("Hello", 0));
  sessions = expireSpeechSessions(sessions, 5.9);
  assert.equal(sessions[0].active, true);
  sessions = expireSpeechSessions(sessions, 6);
  assert.equal(sessions[0].active, false);
  sessions = apply(sessions, result("New conversation", 6));
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].active, true);
});

test("empty results and YAMNet classifications cannot initiate or prolong a conversation", () => {
  assert.equal(apply([], result("", 0)).length, 0);
  assert.equal(apply([], { type: "classification", results: [{ category: "speech", score: 0.99 }] }).length, 0);
  let sessions = apply([], result("Hello", 0, 1, true, false));
  sessions = apply(sessions, result("", 1, 10));
  assert.equal(sessions[0].lastSpeechAudioTime, 1);
});

test("late final text attaches to its old session and Stop removes provisional words", () => {
  let sessions = apply([], result("Hello there", 0, 1, false, false));
  const id = sessions[0].id;
  sessions = expireSpeechSessions(sessions, 6);
  sessions = apply(sessions, result("Hello there", 0));
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].id, id);
  assert.equal(sessions[0].active, false);
  assert.equal(getFinalTranscript(sessions[0].transcript), "Hello there");
  sessions = apply(sessions, result("Another thought", 10));
  sessions = apply(sessions, result("provisional", 11, 1, false, false));
  sessions = closeSpeechSessions(sessions);
  assert.equal(sessions[0].transcript.interimText, "");
  assert.equal(getFinalTranscript(sessions[0].transcript), "Another thought");
});

test("word timing excludes trailing silence from speech activity", () => {
  const message = result("Hello", 0, 9);
  message.channel.alternatives[0].words = [{ end: 1 }];
  const sessions = apply([], message);
  assert.equal(sessions[0].lastSpeechAudioTime, 1);
  assert.equal(expireSpeechSessions(sessions, 6)[0].active, false);
});

test("word start timing separates conversations even when result spans leading silence", () => {
  let sessions = apply([], result("First", 0));
  const message = result("Second", 1, 10);
  message.channel.alternatives[0].words = [{ start: 10, end: 11 }];
  sessions = apply(sessions, message);
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].startAudioTime, 10);
});

test("malformed word timing falls back safely to valid result offsets", () => {
  const message = result("Hello", 0);
  message.channel.alternatives[0].words = "invalid";
  assert.equal(apply([], message)[0].lastSpeechAudioTime, 1);
});

test("an empty interim update clears provisional words without extending the session", () => {
  let sessions = apply([], result("Maybe", 0, 1, false, false));
  sessions = apply(sessions, result("", 1, 5, false, false));
  assert.equal(sessions[0].transcript.interimText, "");
  assert.equal(sessions[0].lastSpeechAudioTime, 1);
});
