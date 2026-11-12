import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import { accountActor } from "../domain/permissions";
import {
  submitFriend,
  reviewFriend,
  listMyFriends,
  listPendingFriends,
  listPublicFriends,
} from "./friends";
test("friend links enforce safe URLs, owner isolation, optional icons and current review permissions", async () => {
  const db = getDb(),
    rollback = new Error("ROLLBACK_FRIEND_TEST");
  try {
    await assert.rejects(
      db.$transaction(
        async (tx) => {
          const suffix = randomUUID();
          const owner = await tx.user.create({
            data: { githubId: `local:friend-${suffix}`, name: "Friend owner", role: "OWNER" },
          });
          const member = await tx.user.create({
            data: { githubId: `friend-${suffix}`, name: "Friend member" },
          });
          const manager = accountActor({ ...owner, permissions: [] }, undefined),
            author = accountActor({ ...member, permissions: [] }, undefined);
          const form = (iconUrl = "") => {
            const value = new FormData();
            for (const [k, v] of Object.entries({
              submissionId: randomUUID(),
              title: "Friend test",
              summary: "<b>Plain text</b>",
              url: "https://example.com",
              iconUrl,
            }))
              value.set(k, v);
            return value;
          };
          const input = form();
          await assert.rejects(submitFriend(tx, null, input), { key: "loginRequired" });
          const invalid = form();
          invalid.set("url", "javascript:alert(1)");
          await assert.rejects(submitFriend(tx, author, invalid), { key: "invalidFriend" });
          invalid.set("url", "https://user:password@example.com");
          await assert.rejects(submitFriend(tx, author, invalid), { key: "invalidFriend" });
          const pending = await submitFriend(tx, author, input);
          assert.equal(pending.publishedVersion, null);
          assert.equal((await submitFriend(tx, author, input)).id, pending.id);
          input.set("summary", "changed");
          await assert.rejects(submitFriend(tx, author, input), {
            key: "friendSubmissionConflict",
          });
          assert.equal(
            (await listPublicFriends(tx)).some((link) => link.id === pending.id),
            false,
          );
          assert.ok((await listMyFriends(tx, author)).some((link) => link.id === pending.id));
          assert.equal(
            (await listMyFriends(tx, manager)).some((link) => link.id === pending.id),
            false,
          );
          assert.throws(() => listPendingFriends(tx, author), { key: "ownerOnly" });
          const approve = new FormData();
          approve.set("decision", "approve");
          approve.set("reason", "");
          await assert.rejects(reviewFriend(tx, author, pending.id, 1, approve), {
            key: "ownerOnly",
          });
          await tx.permissionOverride.create({
            data: { userId: member.id, capability: "friend.submit", effect: "DENY" },
          });
          await assert.rejects(reviewFriend(tx, manager, pending.id, 1, approve), {
            key: "permissionDenied",
          });
          await tx.permissionOverride.deleteMany({ where: { userId: member.id } });
          await reviewFriend(tx, manager, pending.id, 1, approve);
          assert.ok((await listPublicFriends(tx)).some((link) => link.id === pending.id));
          await assert.rejects(reviewFriend(tx, manager, pending.id, 1, approve), {
            key: "friendReviewConflict",
          });
          const image = await tx.media.create({
            data: {
              id: randomUUID(),
              ownerId: member.id,
              storageKey: `${suffix}.webp`,
              mimeType: "image/webp",
              ready: true,
              bytes: 1,
            },
          });
          const iconForm = form(`/api/media/${image.id}`);
          await assert.rejects(submitFriend(tx, author, iconForm), {
            key: "imagePermissionRequired",
          });
          await assert.rejects(submitFriend(tx, manager, iconForm), {
            key: "friendIconUnavailable",
          });
          await tx.permissionOverride.create({
            data: { userId: member.id, capability: "image.upload", effect: "ALLOW" },
          });
          const withIcon = await submitFriend(tx, author, iconForm);
          await tx.media.update({ where: { id: image.id }, data: { ready: false } });
          await assert.rejects(reviewFriend(tx, manager, withIcon.id, 1, approve), {
            key: "friendIconUnavailable",
          });
          await tx.media.update({ where: { id: image.id }, data: { ready: true } });
          await tx.permissionOverride.update({
            where: { userId_capability: { userId: member.id, capability: "image.upload" } },
            data: { effect: "DENY" },
          });
          await assert.rejects(reviewFriend(tx, manager, withIcon.id, 1, approve), {
            key: "permissionDenied",
          });
          const reject = new FormData();
          reject.set("decision", "reject");
          reject.set("reason", "");
          await assert.rejects(reviewFriend(tx, manager, withIcon.id, 1, reject));
          reject.set("reason", "Not suitable");
          await reviewFriend(tx, manager, withIcon.id, 1, reject);
          assert.equal(
            (await listPublicFriends(tx)).some((link) => link.id === withIcon.id),
            false,
          );
          const direct = await submitFriend(tx, manager, form());
          assert.equal(direct.publishedVersion, 1);
          const blocked = await submitFriend(tx, author, form());
          await tx.user.update({ where: { id: member.id }, data: { banned: true } });
          await assert.rejects(reviewFriend(tx, manager, blocked.id, 1, approve), {
            key: "accountBanned",
          });
          await reviewFriend(tx, manager, blocked.id, 1, reject);
          assert.equal(
            await tx.moderationReview.count({ where: { revision: { contentId: pending.id } } }),
            1,
          );
          throw rollback;
        },
        { timeout: 15000 },
      ),
      (error) => error === rollback,
    );
  } finally {
    await db.$disconnect();
  }
});
