import { test } from "node:test";
import assert from "node:assert/strict";
import { authorize, withinQuota, type Actor } from "./permissions.ts";
import { projectUrlAllowed, type SiteRule } from "./project-sites.ts";
import { initialReviewState, canApplyReview } from "./moderation.ts";
const member: Actor = { id: "a", role: "MEMBER", banned: false, overrides: {} };
test("ban and explicit deny take priority, allow cannot grant administration", () => {
  assert.equal(
    authorize({ ...member, banned: true, overrides: { "image.upload": "ALLOW" } }, "image.upload")
      .allowed,
    false,
  );
  assert.equal(
    authorize({ ...member, role: "OWNER", overrides: { "post.submit": "DENY" } }, "post.submit")
      .allowed,
    false,
  );
  assert.equal(
    authorize({ ...member, overrides: { "site.manage": "ALLOW" } }, "site.manage").allowed,
    false,
  );
});
test("ownership and image authorization are independent", () => {
  assert.equal(authorize(member, "post.submit").allowed, true);
  assert.equal(authorize(member, "image.upload").allowed, false);
  assert.equal(
    authorize({ ...member, overrides: { "content.editOwn": "ALLOW" } }, "content.editOwn", "b")
      .allowed,
    false,
  );
});
test("reserved bytes prevent over-allocation; lowering quota doesn't allow more uploads", () => {
  assert.equal(withinQuota(80n, 15n, 6n, 100n), false);
  assert.equal(withinQuota(80n, 15n, 5n, 100n), true);
  assert.equal(withinQuota(80n, 0n, 1n, 50n), false);
  assert.equal(withinQuota(0n, 0n, 1n, 0n), false);
});
test("domain boundary and explicit deny", () => {
  const rules: SiteRule[] = [
    { hostname: "example.com", includeSubdomains: false, effect: "ALLOW", enabled: true },
  ];
  assert.equal(projectUrlAllowed("https://example.com/project", rules), true);
  assert.equal(projectUrlAllowed("https://sub.example.com", rules), false);
  rules[0].includeSubdomains = true;
  assert.equal(projectUrlAllowed("https://sub.example.com", rules), true);
  for (const bad of [
    "https://evilexample.com",
    "https://example.com.evil.org",
    "https://example.com@evil.org",
    "javascript:alert(1)",
  ])
    assert.equal(projectUrlAllowed(bad, rules), false);
  assert.equal(projectUrlAllowed("https://example.com", []), false);
  assert.equal(
    projectUrlAllowed("https://sub.example.com", [
      ...rules,
      { hostname: "sub.example.com", effect: "DENY", enabled: true, includeSubdomains: false },
    ]),
    false,
  );
});
test("owner exemption, unconfigured AI fallback, stale reviews and bans", () => {
  assert.equal(initialReviewState(true, false), "PUBLISHED");
  assert.equal(initialReviewState(false, false), "PENDING_HUMAN");
  assert.equal(initialReviewState(false, true), "PENDING_AI");
  assert.equal(canApplyReview(2, 1, "PENDING_AI", true), false);
  assert.equal(canApplyReview(2, 2, "PUBLISHED", true), false);
  assert.equal(canApplyReview(2, 2, "PENDING_AI", false), false);
});
