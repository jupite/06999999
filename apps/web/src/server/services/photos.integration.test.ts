import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import { accountActor } from "../domain/permissions";
import {
  submitPhoto,
  reviewPhoto,
  listMyPhotos,
  listPendingPhotos,
  listPublicPhotos,
  listPhotoTerms,
} from "./photos";
import { isGithubId } from "./media-settings";

test("photo publication protects media ownership, taxonomy, replay, reviews and revoked permissions", async () => {
  const db = getDb(),
    rollback = new Error("ROLLBACK_PHOTO_TEST");
  try {
    await assert.rejects(
      db.$transaction(
        async (tx) => {
          const suffix = randomUUID();
          const owner = await tx.user.create({
            data: { githubId: `local:photo-${suffix}`, name: "Photo owner", role: "OWNER" },
          });
          const member = await tx.user.create({
            data: { githubId: `photo-${suffix}`, name: "Photo author" },
          });
          await tx.permissionOverride.create({
            data: { userId: member.id, capability: "image.upload", effect: "ALLOW" },
          });
          const manager = accountActor({ ...owner, permissions: [] }, undefined),
            author = accountActor({ ...member, permissions: [] }, undefined);
          assert.ok(isGithubId("local:admin"));
          assert.ok(isGithubId("123456"));
          assert.equal(isGithubId("local:../admin"), false);
          const memberImage = await tx.media.create({
            data: {
              id: randomUUID(),
              ownerId: member.id,
              storageKey: `${suffix}-member.webp`,
              mimeType: "image/webp",
              bytes: 1,
              ready: true,
            },
          });
          const ownerImage = await tx.media.create({
            data: {
              id: randomUUID(),
              ownerId: owner.id,
              storageKey: `${suffix}-owner.webp`,
              mimeType: "image/webp",
              bytes: 1,
              ready: true,
            },
          });
          const category = await tx.category.create({ data: { name: `P${suffix.slice(0, 20)}` } });
          function form(mediaId: string, tag: string) {
            const form = new FormData();
            form.set("submissionId", randomUUID());
            form.set("title", "Photo test");
            form.set("summary", "<b>plain caption</b>");
            form.set("imageUrl", `/api/media/${mediaId}`);
            form.set("categoryId", category.id);
            form.set("tagText", tag);
            return form;
          }
          const pendingForm = form(memberImage.id, `private-${suffix.slice(0, 12)}`);
          await assert.rejects(submitPhoto(tx, null, pendingForm), { key: "loginRequired" });
          await assert.rejects(submitPhoto(tx, author, form(ownerImage.id, "foreign")), {
            key: "photoImageUnavailable",
          });
          const pending = await submitPhoto(tx, author, pendingForm);
          assert.equal(pending.publishedVersion, null);
          assert.equal((await submitPhoto(tx, author, pendingForm)).id, pending.id);
          pendingForm.set("tagText", "changed");
          await assert.rejects(submitPhoto(tx, author, pendingForm), {
            key: "photoSubmissionConflict",
          });
          assert.equal(
            (await listPublicPhotos(tx)).some((photo) => photo.id === pending.id),
            false,
          );
          assert.equal(
            (await listPhotoTerms(tx)).categories.some((item) => item.id === category.id),
            false,
          );
          assert.ok((await listMyPhotos(tx, author)).some((photo) => photo.id === pending.id));
          assert.equal(
            (await listMyPhotos(tx, manager)).some((photo) => photo.id === pending.id),
            false,
          );
          assert.throws(() => listPendingPhotos(tx, author), { key: "ownerOnly" });
          assert.ok(
            (await listPendingPhotos(tx, manager)).some((photo) => photo.id === pending.id),
          );
          const approve = new FormData();
          approve.set("decision", "approve");
          approve.set("reason", "");
          await tx.permissionOverride.update({
            where: { userId_capability: { userId: member.id, capability: "image.upload" } },
            data: { effect: "DENY" },
          });
          await assert.rejects(reviewPhoto(tx, manager, pending.id, 1, approve), {
            key: "permissionDenied",
          });
          await tx.permissionOverride.update({
            where: { userId_capability: { userId: member.id, capability: "image.upload" } },
            data: { effect: "ALLOW" },
          });
          await tx.media.update({ where: { id: memberImage.id }, data: { ready: false } });
          await assert.rejects(reviewPhoto(tx, manager, pending.id, 1, approve), {
            key: "photoImageUnavailable",
          });
          await tx.media.update({ where: { id: memberImage.id }, data: { ready: true } });
          await reviewPhoto(tx, manager, pending.id, 1, approve);
          assert.ok(
            (await listPublicPhotos(tx, 1, { categoryId: category.id })).some(
              (photo) => photo.id === pending.id,
            ),
          );
          const tags = await listPhotoTerms(tx);
          const tag = tags.tags.find((item) =>
            item.name.startsWith(`private-${suffix.slice(0, 12)}`),
          );
          assert.ok(tag);
          assert.ok(
            (await listPublicPhotos(tx, 1, { tagId: tag.id })).some(
              (photo) => photo.id === pending.id,
            ),
          );
          await assert.rejects(reviewPhoto(tx, manager, pending.id, 1, approve), {
            key: "photoReviewConflict",
          });
          const direct = await submitPhoto(tx, manager, form(ownerImage.id, "owner"));
          assert.equal(direct.publishedVersion, 1);
          const rejected = await submitPhoto(tx, author, form(memberImage.id, "reject"));
          const reject = new FormData();
          reject.set("decision", "reject");
          reject.set("reason", "");
          await assert.rejects(reviewPhoto(tx, manager, rejected.id, 1, reject));
          reject.set("reason", "Not suitable");
          await reviewPhoto(tx, manager, rejected.id, 1, reject);
          assert.equal(
            (await listPublicPhotos(tx)).some((photo) => photo.id === rejected.id),
            false,
          );
          const blocked = await submitPhoto(tx, author, form(memberImage.id, "blocked"));
          await tx.user.update({ where: { id: member.id }, data: { banned: true } });
          await assert.rejects(reviewPhoto(tx, manager, blocked.id, 1, approve), {
            key: "accountBanned",
          });
          await reviewPhoto(tx, manager, blocked.id, 1, reject);
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
