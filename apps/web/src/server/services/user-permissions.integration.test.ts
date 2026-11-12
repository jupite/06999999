import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import { accountActor } from "../domain/permissions";
import { createRole, assignUserRole, updateRole } from "./roles";
import { updatePersonalPermission } from "./user-permissions";
test("personal permission API service preserves role inheritance, checks conflicts, and explains final policy", async () => {
  const db = getDb(),
    rollback = new Error("ROLLBACK_PERSONAL_PERMISSION");
  try {
    await assert.rejects(
      db.$transaction(
        async (tx) => {
          const suffix = randomUUID();
          const owner = await tx.user.create({
              data: { githubId: `local:personal-${suffix}`, name: "Owner", role: "OWNER" },
            }),
            user = await tx.user.create({
              data: { githubId: `personal-${suffix}`, name: "Member" },
            });
          const manager = accountActor({ ...owner, permissions: [] }, undefined),
            member = accountActor({ ...user, permissions: [] }, undefined);
          await assert.rejects(
            updatePersonalPermission(tx, null, user.id, "image.upload", {
              mode: "allow",
              expectedMode: "inherit",
            }),
            { key: "loginRequired" },
          );
          await assert.rejects(
            updatePersonalPermission(tx, member, user.id, "image.upload", {
              mode: "allow",
              expectedMode: "inherit",
            }),
            { key: "ownerOnly" },
          );
          await assert.rejects(
            updatePersonalPermission(tx, manager, user.id, "site.manage", {
              mode: "allow",
              expectedMode: "inherit",
            }),
            { key: "permissionCapabilityUnknown" },
          );
          await assert.rejects(
            updatePersonalPermission(tx, manager, user.id, "image.upload", {
              mode: "ALLOW",
              expectedMode: "inherit",
            }),
            { key: "invalidUserAccess" },
          );
          await assert.rejects(
            updatePersonalPermission(tx, manager, user.id, "image.upload", { mode: "allow" }),
            { key: "invalidUserAccess" },
          );
          await assert.rejects(
            updatePersonalPermission(tx, manager, "missing", "image.upload", {
              mode: "allow",
              expectedMode: "inherit",
            }),
            { key: "managedUserMissing" },
          );
          await tx.featureFlag.upsert({
            where: { key: "image.upload" },
            create: { key: "image.upload", enabled: true },
            update: { enabled: true },
          });
          const role = await createRole(tx, manager, {
            name: `P-${suffix}`,
            permissions: { "image.upload": "allow" },
          });
          await assignUserRole(tx, manager, user.id, { roleId: role.id, expectedRoleId: null });
          let result = await updatePersonalPermission(tx, manager, user.id, "image.upload", {
            mode: "inherit",
            expectedMode: "inherit",
          });
          assert.equal(result.source, "role");
          assert.equal(result.allowed, true);
          result = await updatePersonalPermission(tx, manager, user.id, "image.upload", {
            mode: "deny",
            expectedMode: "inherit",
          });
          assert.equal(result.source, "user_override");
          assert.equal(result.allowed, false);
          await assert.rejects(
            updatePersonalPermission(tx, manager, user.id, "image.upload", {
              mode: "allow",
              expectedMode: "inherit",
            }),
            { key: "userAccessConflict" },
          );
          result = await updatePersonalPermission(tx, manager, user.id, "image.upload", {
            mode: "inherit",
            expectedMode: "deny",
          });
          assert.equal(result.allowed, true);
          assert.equal(result.userOverride, "inherit");
          assert.equal(await tx.permissionOverride.count({ where: { userId: user.id } }), 0);
          await updateRole(tx, manager, role.id, {
            expectedVersion: 1,
            permissions: { "image.upload": "deny" },
          });
          result = await updatePersonalPermission(tx, manager, user.id, "image.upload", {
            mode: "allow",
            expectedMode: "inherit",
          });
          assert.equal(result.allowed, true);
          assert.equal(result.roleRule, "deny");
          const count = await tx.auditLog.count({
            where: { action: "user.updatePermission", targetId: user.id },
          });
          await updatePersonalPermission(tx, manager, user.id, "image.upload", {
            mode: "allow",
            expectedMode: "allow",
          });
          assert.equal(
            await tx.auditLog.count({
              where: { action: "user.updatePermission", targetId: user.id },
            }),
            count,
          );
          await tx.featureFlag.update({ where: { key: "image.upload" }, data: { enabled: false } });
          result = await updatePersonalPermission(tx, manager, user.id, "image.upload", {
            mode: "allow",
            expectedMode: "allow",
          });
          assert.equal(result.source, "feature_disabled");
          assert.equal(result.allowed, false);
          await tx.user.update({ where: { id: user.id }, data: { banned: true } });
          result = await updatePersonalPermission(tx, manager, user.id, "image.upload", {
            mode: "allow",
            expectedMode: "allow",
          });
          assert.equal(result.source, "account_banned");
          assert.equal(
            (await tx.user.findUniqueOrThrow({ where: { id: user.id } })).assignedRoleId,
            role.id,
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
