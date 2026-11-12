import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password.ts";
import { accountActor } from "./permissions.ts";
test("salted passwords verify without accepting a different password or malformed hash", async () => {
  const password = "test-long-password-123";
  const a = await hashPassword(password),
    b = await hashPassword(password);
  assert.notEqual(a, b);
  assert.equal(await verifyPassword(password, a), true);
  assert.equal(await verifyPassword("wrong", a), false);
  assert.equal(await verifyPassword(password, "invalid"), false);
});
test("local owner requires a reserved local identity and persisted owner role", () => {
  const user = {
    id: "test",
    githubId: "local:admin",
    role: "OWNER" as const,
    banned: false,
    permissions: [],
  };
  assert.equal(accountActor(user, undefined).role, "OWNER");
  assert.equal(accountActor({ ...user, role: "MEMBER" }, undefined).role, "MEMBER");
  assert.equal(accountActor({ ...user, githubId: "123" }, undefined).role, "MEMBER");
});
