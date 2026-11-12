import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import { accountActor } from "../domain/permissions";
import { readRejectedSubmission } from "./resubmission";
import { submitPhoto } from "./photos";
import { submitFriend } from "./friends";
test("rejected photo and friend copies preserve history and media while enforcing author and current permissions", async () => {
  const db = getDb(),
    rollback = new Error("ROLLBACK_RESUBMISSION");
  try {
    await assert.rejects(
      db.$transaction(
        async (tx) => {
          const suffix = randomUUID(),
            user = await tx.user.create({
              data: { githubId: `resubmit-${suffix}`, name: "Member" },
            }),
            owner = await tx.user.create({
              data: { githubId: `local:resubmit-${suffix}`, name: "Owner", role: "OWNER" },
            });
          await tx.permissionOverride.create({
            data: { userId: user.id, capability: "image.upload", effect: "ALLOW" },
          });
          const author = accountActor(
              { ...user, permissions: [{ capability: "image.upload", effect: "ALLOW" as const }] },
              undefined,
            ),
            manager = accountActor({ ...owner, permissions: [] }, undefined);
          const media = await tx.media.create({
            data: {
              id: randomUUID(),
              ownerId: user.id,
              storageKey: `${suffix}.webp`,
              mimeType: "image/webp",
              bytes: 123,
              ready: true,
            },
          });
          await tx.storageQuota.create({
            data: { userId: user.id, limitBytes: 1000, usedBytes: 123 },
          });
          for (const kind of ["PHOTO", "FRIEND_LINK"] as const) {
            const source = await tx.content.create({
              data: {
                kind,
                authorId: user.id,
                slug: randomUUID(),
                revisions: {
                  create: {
                    version: 1,
                    title: "Rejected title",
                    summary: "Original",
                    targetUrl: kind === "FRIEND_LINK" ? "https://example.com/" : null,
                    state: "REJECTED",
                    media: { connect: { id: media.id } },
                    reviews: {
                      create: { targetVersion: 1, result: "REJECTED", reason: "Revise this" },
                    },
                  },
                },
              },
            });
            assert.ok(await readRejectedSubmission(tx, author, source.id, kind));
            assert.equal(await readRejectedSubmission(tx, manager, source.id, kind), null);
            await assert.rejects(
              readRejectedSubmission(
                tx,
                { ...author, overrides: { "content.editOwn": "DENY" } },
                source.id,
                kind,
              ),
              { key: "permissionDenied" },
            );
            const form = new FormData();
            for (const [k, v] of Object.entries({
              submissionId: randomUUID(),
              sourceId: source.id,
              title: "Corrected title",
              summary: "Corrected description",
              imageUrl: `/api/media/${media.id}`,
              iconUrl: `/api/media/${media.id}`,
              url: "https://example.com/updated",
              categoryId: "",
              tagText: "",
            }))
              form.set(k, v);
            const copy = await (kind === "PHOTO"
              ? submitPhoto(tx, author, form)
              : submitFriend(tx, author, form));
            assert.notEqual(copy.id, source.id);
            assert.equal(copy.publishedVersion, null);
            const copied = await tx.contentRevision.findUniqueOrThrow({
              where: { contentId_version: { contentId: copy.id, version: 1 } },
              include: { media: true },
            });
            assert.equal(copied.state, "PENDING_HUMAN");
            assert.equal(copied.media[0].id, media.id);
            assert.equal(
              (
                await tx.contentRevision.findUniqueOrThrow({
                  where: { contentId_version: { contentId: source.id, version: 1 } },
                })
              ).state,
              "REJECTED",
            );
            assert.equal(
              await tx.moderationReview.count({ where: { revision: { contentId: source.id } } }),
              1,
            );
            assert.equal(
              (
                await (kind === "PHOTO"
                  ? submitPhoto(tx, author, form)
                  : submitFriend(tx, author, form))
              ).id,
              copy.id,
            );
            await tx.permissionOverride.create({
              data: { userId: user.id, capability: "content.editOwn", effect: "DENY" },
            });
            form.set("submissionId", randomUUID());
            await assert.rejects(
              kind === "PHOTO" ? submitPhoto(tx, author, form) : submitFriend(tx, author, form),
              { key: "permissionDenied" },
            );
            await tx.permissionOverride.deleteMany({
              where: { userId: user.id, capability: "content.editOwn" },
            });
            form.set("sourceId", copy.id);
            await assert.rejects(
              kind === "PHOTO" ? submitPhoto(tx, author, form) : submitFriend(tx, author, form),
              { key: "submissionCopyUnavailable" },
            );
            form.set("sourceId", source.id);
            form.set("iconUrl", "");
            form.set("imageUrl", `/api/media/${media.id}`);
            await assert.rejects(
              kind === "PHOTO" ? submitPhoto(tx, manager, form) : submitFriend(tx, manager, form),
              { key: "submissionCopyUnavailable" },
            );
            await tx.contentRevision.update({
              where: { contentId_version: { contentId: source.id, version: 1 } },
              data: { state: "WITHDRAWN" },
            });
            assert.equal(await readRejectedSubmission(tx, author, source.id, kind), null);
          }
          assert.equal(await tx.media.count({ where: { ownerId: user.id } }), 1);
          assert.equal(
            (await tx.storageQuota.findUniqueOrThrow({ where: { userId: user.id } })).usedBytes,
            123n,
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
