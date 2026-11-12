import { test } from "node:test";
import assert from "node:assert/strict";
import { authorize, type Actor } from "./permissions.ts";
test("role presets follow global flags and personal overrides without granting management", () => {
  const actor: Actor = {
    id: "member",
    role: "MEMBER",
    banned: false,
    overrides: {},
    roleRules: { "image.upload": "ALLOW", "friend.submit": "DENY", "site.manage": "ALLOW" },
  };
  assert.equal(authorize(actor, "image.upload").reason, "rolePermissionGranted");
  assert.equal(authorize(actor, "friend.submit").reason, "rolePermissionDenied");
  assert.equal(authorize(actor, "site.manage").reason, "ownerOnly");
  assert.equal(
    authorize({ ...actor, overrides: { "friend.submit": "ALLOW" } }, "friend.submit").allowed,
    true,
  );
  assert.equal(
    authorize({ ...actor, overrides: { "image.upload": "DENY" } }, "image.upload").allowed,
    false,
  );
  assert.equal(
    authorize({ ...actor, features: { "image.upload": false } }, "image.upload").reason,
    "featureDisabled",
  );
  assert.equal(authorize({ ...actor, banned: true }, "image.upload").reason, "accountBanned");
  assert.equal(
    authorize({ ...actor, roleRules: {} }, "image.upload").reason,
    "imagePermissionRequired",
  );
});
