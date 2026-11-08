import { test } from "node:test";
import assert from "node:assert/strict";
import { articleReference, reviewInput, articlePage } from "./articles.ts";
test("article references require a valid version and rejection requires a reason", () => {
  for (const args of [
    [null, 1],
    ["", 1],
    ["id", 0],
    ["id", 1.5],
    ["id", "1"],
  ])
    assert.throws(() => articleReference(...(args as [unknown, unknown])));
  assert.deepEqual(articleReference("id", 2), { id: "id", version: 2 });
  assert.throws(() => reviewInput("reject", "  "));
  assert.throws(() => reviewInput("publish", "reason"));
  assert.throws(() => reviewInput("approve", "x".repeat(2001)));
  assert.deepEqual(reviewInput("reject", " 请修改 "), { decision: "reject", reason: "请修改" });
  assert.equal(articlePage("2"), 2);
  for (const page of ["0", "-1", "1.5", "Infinity", ["1"], "100001", undefined])
    assert.equal(articlePage(page), 1);
});
