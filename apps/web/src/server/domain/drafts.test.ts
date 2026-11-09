import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDraft, requireDraftActor } from "./drafts.ts";
import type { Actor } from "./permissions.ts";
const member: Actor = { id: "test", role: "MEMBER", banned: false, overrides: {} };
test("draft input validates title, body and optimistic version", () => {
  assert.equal(parseDraft({ title: " 标题 ", markdown: "", version: 0 }).title, "标题");
  for (const value of [
    null,
    {},
    { title: " ", markdown: "", version: 0 },
    { title: "x".repeat(161), markdown: "", version: 0 },
    { title: "标题", markdown: "x".repeat(100001), version: 0 },
    { title: "标题", markdown: "", version: 2 },
    { id: "a", title: "标题", markdown: "", version: 0 },
  ])
    assert.throws(() => parseDraft(value));
});
test("draft creation and editing honor login, ban and explicit permissions", () => {
  assert.throws(() => requireDraftActor(null));
  assert.throws(() => requireDraftActor({ ...member, banned: true }));
  assert.throws(() => requireDraftActor({ ...member, overrides: { "post.submit": "DENY" } }));
  assert.throws(() =>
    requireDraftActor({ ...member, role: "OWNER", overrides: { "content.editOwn": "DENY" } }, true),
  );
  assert.equal(requireDraftActor(member).id, "test");
});

test("draft taxonomy validates category identifiers and normalizes unique tags", () => {
  const draft = { version: 0, title: "Notes", markdown: "" };
  assert.equal(
    parseDraft({ ...draft, categoryId: null, tagText: " Café，Cafe\u0301, 笔记 " }).tagText,
    "Café, 笔记",
  );
  assert.throws(() => parseDraft({ ...draft, categoryId: ["x"] }), {
    message: "invalidArticleCategory",
  });
  assert.throws(() => parseDraft({ ...draft, tagText: "a,b,c,d,e,f" }), {
    message: "invalidArticleTags",
  });
  assert.throws(() => parseDraft({ ...draft, tagText: "x".repeat(33) }), {
    message: "invalidArticleTags",
  });
});
