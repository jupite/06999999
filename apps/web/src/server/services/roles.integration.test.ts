import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import sharp from "sharp";
import { accountActor, authorize } from "../domain/permissions";
import { resolveAccountActor } from "../access";
import {
  listRoles,
  createRole,
  getRole,
  updateRole,
  deleteRole,
  assignUserRole,
  effectivePermissions,
} from "./roles";
import { listUserAccounts } from "./user-access";
import { updateFeature } from "./features";
import { submitFriend } from "./friends";
import { reviewArticle } from "./articles";
import { saveDraft } from "./drafts";
import { saveUserMediaAccess } from "./media-settings";
import { storeImage } from "./media";

test("role presets apply to real actions, preserve personal overrides, and cannot grant management", async () => {
  const connectionString = process.env.DATABASE_URL;
  assert.ok(connectionString);
  const schema = `roles_test_${randomBytes(8).toString("hex")}`;
  const pool = new Pool({ connectionString, max: 1 });
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString, options: `-c search_path=${schema}` }, { schema }),
  });
  const tempRoot = await realpath(tmpdir()),
    root = await mkdtemp(join(tempRoot, "role-media-test-"));
  const priorRoot = process.env.MEDIA_ROOT;
  process.env.MEDIA_ROOT = root;
  try {
    const entries = await readdir("prisma/migrations", { withFileTypes: true });
    const sql = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
        .map((name) => readFile(join("prisma/migrations", name, "migration.sql"), "utf8")),
    );
    await pool.query(`CREATE SCHEMA "${schema}";SET search_path TO "${schema}";${sql.join("\n")}`);
    const owner = await db.user.create({
        data: { githubId: "local:roles-owner", name: "Owner", role: "OWNER" },
      }),
      member = await db.user.create({ data: { githubId: "123456", name: "Member" } });
    const manager = accountActor({ ...owner, permissions: [] }, undefined),
      actor = accountActor({ ...member, permissions: [] }, undefined);
    await assert.rejects(listRoles(db, actor), { key: "ownerOnly" });
    await assert.rejects(listRoles(db, null), { key: "loginRequired" });
    await assert.rejects(
      db.$transaction((tx) =>
        createRole(tx, manager, { name: "Bad", permissions: { "site.manage": "allow" } }),
      ),
      { key: "roleInvalid" },
    );
    await assert.rejects(
      db.$transaction((tx) =>
        createRole(tx, manager, { name: "Bad", permissions: { unknown: "allow" } }),
      ),
      { key: "roleInvalid" },
    );
    const role = await db.$transaction((tx) =>
      createRole(tx, manager, {
        name: "Contributor",
        permissions: { "image.upload": "allow", "friend.submit": "deny" },
      }),
    );
    assert.equal(role.version, 1);
    assert.equal(role.userCount, 0);
    assert.equal(role.permissions["post.submit"], "inherit");
    await assert.rejects(
      db.$transaction((tx) => createRole(tx, manager, { name: "Contributor", permissions: {} })),
      { key: "roleNameTaken" },
    );
    await assert.rejects(
      db.$transaction((tx) =>
        assignUserRole(tx, actor, member.id, { roleId: role.id, expectedRoleId: null }),
      ),
      { key: "ownerOnly" },
    );
    await assert.rejects(
      db.$transaction((tx) =>
        assignUserRole(tx, manager, owner.id, { roleId: role.id, expectedRoleId: null }),
      ),
      { key: "ownerAccountProtected" },
    );
    await db.$transaction((tx) =>
      assignUserRole(tx, manager, member.id, { roleId: role.id, expectedRoleId: null }),
    );
    assert.equal((await getRole(db, manager, role.id)).userCount, 1);
    assert.ok(
      (await listUserAccounts(db, manager, { page: 1, search: "", roleId: role.id })).some(
        (user) => user.id === member.id,
      ),
    );
    assert.equal(
      (await listUserAccounts(db, manager, { page: 1, search: "", roleId: "none" })).some(
        (user) => user.id === member.id,
      ),
      false,
    );
    await assert.rejects(
      db.$transaction((tx) => deleteRole(tx, manager, role.id, 1)),
      { key: "roleInUse" },
    );
    await assert.rejects(
      db.$transaction((tx) =>
        assignUserRole(tx, manager, member.id, { roleId: null, expectedRoleId: null }),
      ),
      { key: "roleAssignmentConflict" },
    );
    let current = await resolveAccountActor(db, { ...member, permissions: [] });
    assert.equal(authorize(current, "image.upload").reason, "rolePermissionGranted");
    assert.equal(authorize(current, "friend.submit").reason, "rolePermissionDenied");
    assert.equal(authorize(current, "site.manage").allowed, false);
    const friendForm = new FormData();
    for (const [k, v] of Object.entries({
      submissionId: randomUUID(),
      title: "Test friend",
      summary: "About",
      url: "https://example.com",
    }))
      friendForm.set(k, v);
    await assert.rejects(
      db.$transaction((tx) => submitFriend(tx, actor, friendForm)),
      { key: "rolePermissionDenied" },
    );
    await db.permissionOverride.create({
      data: { userId: member.id, capability: "friend.submit", effect: "ALLOW" },
    });
    await db.$transaction((tx) => submitFriend(tx, actor, friendForm));
    const userWithOverrides = await db.user.findUniqueOrThrow({
      where: { id: member.id },
      include: { permissions: true },
    });
    current = await resolveAccountActor(db, userWithOverrides);
    assert.equal(authorize(current, "friend.submit").reason, "permissionGranted");
    await db.permissionOverride.create({
      data: { userId: member.id, capability: "image.upload", effect: "DENY" },
    });
    const deniedUser = await db.user.findUniqueOrThrow({
      where: { id: member.id },
      include: { permissions: true },
    });
    assert.equal(
      authorize(await resolveAccountActor(db, deniedUser), "image.upload").reason,
      "permissionDenied",
    );
    const quotaForm = new FormData();
    quotaForm.set("permissionMode", "inherit");
    quotaForm.set("userMib", "10");
    await saveUserMediaAccess(db, manager, member.githubId, quotaForm);
    assert.equal(
      await db.permissionOverride.count({
        where: { userId: member.id, capability: "image.upload" },
      }),
      0,
    );
    await db.siteSettings.create({
      data: { id: "site", maxImageBytes: 1000000, totalMediaLimitBytes: 20000000 },
    });
    const png = await sharp({
      create: { width: 40, height: 30, channels: 3, background: "#9959ee" },
    })
      .png()
      .toBuffer();
    const fresh = await resolveAccountActor(db, userWithOverrides);
    await storeImage(db, fresh, new Blob([new Uint8Array(png)]).stream());
    await db.$transaction((tx) =>
      updateFeature(tx, manager, "image.upload", { enabled: false, expectedEnabled: true }),
    );
    assert.equal(
      (await effectivePermissions(db, manager, member.id)).permissions.find(
        (item) => item.key === "image.upload",
      )?.source,
      "feature_disabled",
    );
    await db.$transaction((tx) =>
      updateFeature(tx, manager, "image.upload", { enabled: true, expectedEnabled: false }),
    );
    const changed = await db.$transaction((tx) =>
      updateRole(tx, manager, role.id, {
        expectedVersion: 1,
        permissions: { "image.upload": "deny", "post.submit": "deny" },
      }),
    );
    assert.equal(changed.version, 2);
    await assert.rejects(
      db.$transaction((tx) =>
        updateRole(tx, manager, role.id, { expectedVersion: 1, name: "Stale" }),
      ),
      { key: "roleConflict" },
    );
    await assert.rejects(storeImage(db, fresh, new Blob([new Uint8Array(png)]).stream()), {
      message: "rolePermissionDenied",
    });
    await assert.rejects(
      db.$transaction((tx) => saveDraft(tx, actor, { title: "Blocked", markdown: "", version: 0 })),
      { notice: "rolePermissionDenied" },
    );
    const pending = await db.content.create({
      data: {
        kind: "POST",
        authorId: member.id,
        slug: randomUUID(),
        revisions: { create: { version: 1, title: "Queued", state: "PENDING_HUMAN" } },
      },
    });
    await assert.rejects(
      db.$transaction((tx) => reviewArticle(tx, manager, pending.id, 1, "approve", "")),
      (error: any) => error.notice?.reason === "rolePermissionDenied",
    );
    const effective = await effectivePermissions(db, manager, member.id);
    assert.equal(effective.roleId, role.id);
    assert.equal(effective.permissions.find((item) => item.key === "post.submit")?.source, "role");
    await db.user.update({ where: { id: member.id }, data: { banned: true } });
    assert.equal(
      (await effectivePermissions(db, manager, member.id)).permissions.find(
        (item) => item.key === "post.submit",
      )?.source,
      "account_banned",
    );
    await db.user.update({ where: { id: member.id }, data: { banned: false } });
    await db.$transaction((tx) =>
      assignUserRole(tx, manager, member.id, { roleId: null, expectedRoleId: role.id }),
    );
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: member.id } })).sessionVersion, 0);
    assert.equal(
      (await effectivePermissions(db, manager, member.id)).permissions.find(
        (item) => item.key === "post.submit",
      )?.source,
      "default",
    );
    assert.equal(
      await db.permissionOverride.count({
        where: { userId: member.id, capability: "friend.submit", effect: "ALLOW" },
      }),
      1,
    );
    await assert.rejects(
      db.$transaction((tx) => deleteRole(tx, manager, role.id, 1)),
      { key: "roleConflict" },
    );
    await db.$transaction((tx) => deleteRole(tx, manager, role.id, 2));
    await assert.rejects(getRole(db, manager, role.id), { key: "roleMissing" });
    const raceRole = await db.$transaction((tx) =>
      createRole(tx, manager, { name: "Race role", permissions: {} }),
    );
    const race = await Promise.allSettled([
      db.$transaction((tx) =>
        assignUserRole(tx, manager, member.id, { roleId: raceRole.id, expectedRoleId: null }),
      ),
      db.$transaction((tx) => deleteRole(tx, manager, raceRole.id, 1)),
    ]);
    assert.equal(race.filter((result) => result.status === "fulfilled").length, 1);
    const failed = race.find((result) => result.status === "rejected");
    assert.ok(
      failed &&
        failed.status === "rejected" &&
        (failed.reason.key === "roleInUse" || failed.reason.key === "roleMissing"),
    );
    const finalUser = await db.user.findUniqueOrThrow({
      where: { id: member.id },
      include: { assignedRole: true },
    });
    assert.ok(
      finalUser.assignedRoleId === null || finalUser.assignedRole?.id === finalUser.assignedRoleId,
    );
    assert.ok((await db.auditLog.count({ where: { action: "role.create" } })) >= 2);
    assert.equal(await db.auditLog.count({ where: { action: "role.update" } }), 1);
  } finally {
    if (priorRoot === undefined) delete process.env.MEDIA_ROOT;
    else process.env.MEDIA_ROOT = priorRoot;
    await db.$disconnect();
    try {
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await pool.end();
      const resolved = await realpath(root);
      if (resolved === root && dirname(resolved) === tempRoot)
        await rm(root, { recursive: true, force: true });
    }
  }
});
