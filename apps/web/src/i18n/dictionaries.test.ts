import assert from "node:assert/strict";
import { test } from "node:test";
import english from "./dictionaries/en.json" with { type: "json" };
import chinese from "./dictionaries/zh.json" with { type: "json" };

test("both dictionaries use the same letter-only camelCase keys", () => {
  assert.deepEqual(Object.keys(english).sort(), Object.keys(chinese).sort());
  for (const section of ["messages", "system"] as const) {
    const keys = Object.keys(chinese[section]).sort();
    assert.deepEqual(Object.keys(english[section]).sort(), keys);
    for (const key of keys) {
      assert.match(key, /^[a-z][A-Za-z]*$/);
    }
  }
});
