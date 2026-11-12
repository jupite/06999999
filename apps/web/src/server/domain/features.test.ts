import { test } from "node:test";
import assert from "node:assert/strict";
import { authorize, type Actor } from "./permissions.ts";
test("site feature flags precede personal grants and owner privileges without disabling management", () => {
  const actor: Actor = {
    id: "owner",
    role: "OWNER",
    banned: false,
    overrides: { "post.submit": "ALLOW" },
    features: { "post.submit": false, "site.manage": false },
  };
  assert.deepEqual(authorize(actor, "post.submit"), { allowed: false, reason: "featureDisabled" });
  assert.equal(authorize(actor, "site.manage").allowed, true);
  assert.equal(authorize({ ...actor, banned: true }, "post.submit").reason, "accountBanned");
});
