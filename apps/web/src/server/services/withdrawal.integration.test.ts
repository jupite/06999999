import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import { accountActor } from "../domain/permissions";
import { withdrawOwnSubmission } from "./withdrawal";
import { listPublicFriends, listPendingFriends, reviewFriend } from "./friends";
import { listPublicPhotos, listPendingPhotos, reviewPhoto } from "./photos";

test("withdrawal preserves records, enforces authors and current permission, and invalidates stale reviews", async () => {
  const db = getDb(),
    rollback = new Error("ROLLBACK_WITHDRAWAL_TEST");
  try {
    await assert.rejects(
      db.$transaction(
        async (tx) => {
          const suffix = randomUUID();
          const owner = await tx.user.create({
            data: { githubId: `local:withdrawal-${suffix}`, name: "Owner", role: "OWNER" },
          });
          const member = await tx.user.create({
            data: { githubId: `withdrawal-${suffix}`, name: "Member" },
          });
          const manager = accountActor({ ...owner, permissions: [] }, undefined),
            author = accountActor({ ...member, permissions: [] }, undefined);
          const media = await tx.media.create({
            data: {
              id: randomUUID(),
              ownerId: member.id,
              storageKey: `${suffix}.webp`,
              mimeType: "image/webp",
              ready: true,
              bytes: 10,
            },
          });
          for (const kind of ["PHOTO", "FRIEND_LINK"] as const) {
            for (const state of ["PENDING_HUMAN", "PUBLISHED"] as const) {
              const content = await tx.content.create({
                data: {
                  kind,
                  authorId: member.id,
                  slug: randomUUID(),
                  publishedVersion: state === "PUBLISHED" ? 1 : null,
                  revisions: {
                    create: {
                      version: 1,
                      title: "withdraw",
                      state,
                      targetUrl: "https://example.com",
                      media: { connect: { id: media.id } },
                    },
                  },
                },
              });
              await assert.rejects(withdrawOwnSubmission(tx, null, content.id, 1, kind, state), {
                key: "loginRequired",
              });
              await assert.rejects(withdrawOwnSubmission(tx, manager, content.id, 1, kind, state), {
                key: "withdrawalConflict",
              });
              await assert.rejects(withdrawOwnSubmission(tx, author, content.id, 2, kind, state), {
                key: "withdrawalConflict",
              });
              await assert.rejects(
                withdrawOwnSubmission(
                  tx,
                  author,
                  content.id,
                  1,
                  kind,
                  state === "PUBLISHED" ? "PENDING_HUMAN" : "PUBLISHED",
                ),
                { key: "withdrawalConflict" },
              );
              await tx.permissionOverride.create({
                data: { userId: member.id, capability: "content.editOwn", effect: "DENY" },
              });
              await assert.rejects(withdrawOwnSubmission(tx, author, content.id, 1, kind, state), {
                key: "permissionDenied",
              });
              await tx.permissionOverride.deleteMany({ where: { userId: member.id } });
              // Withdrawal remains available even when submission/upload permission has been revoked.
              await tx.permissionOverride.createMany({
                data: [
                  {
                    userId: member.id,
                    capability: kind === "PHOTO" ? "photo.submit" : "friend.submit",
                    effect: "DENY",
                  },
                  { userId: member.id, capability: "image.upload", effect: "DENY" },
                ],
              });
              await withdrawOwnSubmission(tx, author, content.id, 1, kind, state);
              await tx.permissionOverride.deleteMany({ where: { userId: member.id } });
              const retained = await tx.content.findUniqueOrThrow({
                where: { id: content.id },
                include: { revisions: true },
              });
              assert.equal(retained.publishedVersion, null);
              assert.equal(retained.revisions[0].state, "WITHDRAWN");
              assert.ok(await tx.media.findUnique({ where: { id: media.id } }));
              assert.equal(
                (await listPublicPhotos(tx)).some((row) => row.id === content.id),
                false,
              );
              assert.equal(
                (await listPublicFriends(tx)).some((row) => row.id === content.id),
                false,
              );
              assert.equal(
                (await listPendingPhotos(tx, manager)).some((row) => row.id === content.id),
                false,
              );
              assert.equal(
                (await listPendingFriends(tx, manager)).some((row) => row.id === content.id),
                false,
              );
              await assert.rejects(withdrawOwnSubmission(tx, author, content.id, 1, kind, state), {
                key: "withdrawalConflict",
              });
              const approve = new FormData();
              approve.set("decision", "approve");
              approve.set("reason", "");
              await assert.rejects(
                kind === "PHOTO"
                  ? reviewPhoto(tx, manager, content.id, 1, approve)
                  : reviewFriend(tx, manager, content.id, 1, approve),
              );
              assert.equal(
                await tx.auditLog.count({
                  where: {
                    targetId: content.id,
                    action: kind === "PHOTO" ? "photo.withdraw" : "friend.withdraw",
                  },
                }),
                1,
              );
              assert.equal(
                await tx.moderationReview.count({
                  where: { revisionId: retained.revisions[0].id, result: "WITHDRAWN" },
                }),
                1,
              );
            }
          }
          await tx.user.update({ where: { id: member.id }, data: { banned: true } });
          await assert.rejects(
            withdrawOwnSubmission(tx, author, "missing", 1, "PHOTO", "PUBLISHED"),
            { key: "accountBanned" },
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
