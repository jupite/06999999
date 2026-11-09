import assert from "node:assert/strict";
import test from "node:test";
import { parseLyrics } from "./lyrics.ts";

test("parses sorted, repeated timestamps without displaying LRC metadata", () => {
  assert.deepEqual(parseLyrics("[ar:Artist]\r\n[01:02.10][00:02.500]Chorus\n[00:01]Opening"), [
    { time: 1, text: "Opening" },
    { time: 2.5, text: "Chorus" },
    { time: 62.1, text: "Chorus" },
  ]);
});

test("supports untimed text and empty lyrics", () => {
  assert.deepEqual(parseLyrics("[ti:Title]\nPlain line"), [{ time: null, text: "Plain line" }]);
  assert.deepEqual(parseLyrics("[ti:Title]\n[00:00.000]"), []);
});

test("positive LRC offsets display lines earlier", () => {
  assert.deepEqual(parseLyrics("[offset:+500]\n[00:02.25]Line"), [{ time: 1.75, text: "Line" }]);
});
