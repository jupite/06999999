import assert from "node:assert/strict";
import test from "node:test";
import { musicSourceUrl, parseMusicSource } from "./source.ts";

test("accepts desktop and mobile NetEase song and playlist links", () => {
  const song = { kind: "song", id: "347230" } as const;
  assert.deepEqual(parseMusicSource(musicSourceUrl(song)), song);
  assert.deepEqual(parseMusicSource(" https://music.163.com/song?id=347230 "), song);
  assert.deepEqual(parseMusicSource("https://y.music.163.com/m/playlist?id=123&uct=abc"), {
    kind: "playlist",
    id: "123",
  });
});

test("rejects arbitrary URLs, off-origin fragments, and malformed IDs", () => {
  for (const url of [
    "https://music.163.com.evil.example/song?id=347230",
    "https://music.163.com/#//evil.example/song?id=347230",
    "https://account@music.163.com/song?id=347230",
    "https://music.163.com:8443/song?id=347230",
    "https://music.163.com/#/artist?id=347230",
    "https://music.163.com/song?id=0",
    "https://music.163.com/song?id=1e3",
    "javascript:alert(1)",
  ]) {
    assert.equal(parseMusicSource(url), null, url);
  }
});
