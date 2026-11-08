import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import { saveDraft, readDraft, listDrafts, deleteDraft } from "./drafts";
import type { Actor } from "../domain/permissions";

test("database drafts persist revisions, isolate authors, reject stale edits and delete atomically", async () => {
  const db = getDb();
  const rollback = new Error("ROLLBACK_TEST_FIXTURES");
  try {
    await assert.rejects(
      db.$transaction(
        async (tx) => {
          const user = await tx.user.create({
            data: { githubId: `draft-test-${randomUUID()}`, name: "草稿测试" },
          });
          const other = await tx.user.create({
            data: { githubId: `draft-test-${randomUUID()}`, name: "隔离测试" },
          });
          const actor: Actor = { id: user.id, role: "MEMBER", banned: false, overrides: {} };
          const stranger: Actor = { ...actor, id: other.id, role: "OWNER" };
          const first = await saveDraft(tx, actor, {
            version: 0,
            title: "旅行游记",
            markdown: "第一天",
          });
          assert.equal((await readDraft(tx, actor, first.id))?.markdown, "第一天");
          assert.equal((await listDrafts(tx, actor)).length, 1);
          assert.equal(await readDraft(tx, stranger, first.id), null);
          assert.equal((await listDrafts(tx, stranger)).length, 0);
          await assert.rejects(saveDraft(tx, stranger, { ...first, markdown: "越权修改" }));
          await assert.rejects(deleteDraft(tx, stranger, first.id, first.version));
          const second = await saveDraft(tx, actor, { ...first, markdown: "第二天" });
          assert.equal(second.version, 2);
          assert.equal((await readDraft(tx, actor, first.id))?.markdown, "第二天");
          assert.equal(await tx.contentRevision.count({ where: { contentId: first.id } }), 2);
          await assert.rejects(saveDraft(tx, actor, { ...first, markdown: "旧页面覆盖" }));
          await assert.rejects(deleteDraft(tx, actor, first.id, first.version));
          assert.equal((await readDraft(tx, actor, first.id))?.markdown, "第二天");
          await deleteDraft(tx, actor, second.id, second.version);
          assert.equal(await readDraft(tx, actor, second.id), null);
          assert.equal(await tx.contentRevision.count({ where: { contentId: second.id } }), 0);
          const pending = await saveDraft(tx, actor, {
            version: 0,
            title: "待审核",
            markdown: "正文",
          });
          await tx.contentRevision.update({
            where: { contentId_version: { contentId: pending.id, version: 1 } },
            data: { state: "PENDING_HUMAN" },
          });
          await assert.rejects(saveDraft(tx, actor, pending));
          await assert.rejects(deleteDraft(tx, actor, pending.id, pending.version));
          assert.equal((await listDrafts(tx, actor)).length, 0);
          throw rollback;
        },
        { timeout: 20000 },
      ),
      (error) => error === rollback,
    );
  } finally {
    await db.$disconnect();
  }
});
