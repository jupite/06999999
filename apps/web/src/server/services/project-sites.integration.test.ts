import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { getDb } from "../db";
import type { Actor } from "../domain/permissions";
import { checkProjectWebsite, listProjectSiteRules, saveProjectSiteRule } from "./project-sites";
import { listOwnProjects, listPublishedProjects, reviewProject, submitProject } from "./projects";
import { imageUrl } from "@/media/urls";

function form(values: Record<string, string>) {
  const fields = new FormData();
  for (const [key, value] of Object.entries(values)) fields.set(key, value);
  return fields;
}

test("project cards enforce URL and author rules at submission and approval", async () => {
  const db = getDb();
  const rollback = new Error("ROLLBACK_PROJECT_SUBMISSIONS_TEST");
  try {
    await assert.rejects(
      db.$transaction(
        async (tx) => {
          const nonce = randomUUID();
          const ownerUser = await tx.user.create({
            data: { githubId: `projects-owner-${nonce}`, name: "Owner" },
          });
          const memberUser = await tx.user.create({
            data: { githubId: `projects-member-${nonce}`, name: "Author" },
          });
          const owner: Actor = { id: ownerUser.id, role: "OWNER", banned: false, overrides: {} };
          const member: Actor = { id: memberUser.id, role: "MEMBER", banned: false, overrides: {} };
          const hostname = `cards.test-${nonce}`;
          const submission = (title: string, cover = "") =>
            form({
              title,
              summary: "Project description",
              url: `https://${hostname}/work`,
              cover,
              submissionId: randomUUID(),
            });
          const approve = form({ decision: "approve", reason: "" });
          await assert.rejects(submitProject(tx, null, submission("Anonymous")), {
            message: "loginRequired",
          });
          await assert.rejects(submitProject(tx, owner, submission("Unlisted")), {
            message: "projectWebsiteUnmatched",
          });
          await saveProjectSiteRule(
            tx,
            owner,
            form({ scope: "create", hostname, effect: "ALLOW" }),
          );

          const coverId = randomUUID();
          await tx.media.create({
            data: {
              id: coverId,
              ownerId: member.id,
              storageKey: `${coverId}.webp`,
              mimeType: "image/webp",
              bytes: 3n,
              ready: true,
            },
          });
          await assert.rejects(
            submitProject(tx, owner, submission("Foreign cover", imageUrl(coverId))),
            { message: "invalidProjectCover" },
          );
          const request = submission("Member project", imageUrl(coverId));
          const project = await submitProject(tx, member, request);
          assert.equal(await submitProject(tx, member, request), project);
          assert.equal((await listOwnProjects(tx, member, 1)).length, 1);
          assert.equal((await listOwnProjects(tx, owner, 1)).length, 0);
          assert.ok(!(await listPublishedProjects(tx)).some(({ id }) => id === project));
          await assert.rejects(reviewProject(tx, member, project, 1, approve), {
            message: "ownerOnly",
          });

          await saveProjectSiteRule(tx, owner, form({ scope: "create", hostname, effect: "DENY" }));
          await assert.rejects(reviewProject(tx, owner, project, 1, approve), {
            message: "projectWebsiteDenied",
          });
          assert.equal(
            (await listOwnProjects(tx, member, 1))[0].revisions[0].state,
            "PENDING_HUMAN",
          );
          await tx.projectSiteRule.updateMany({
            where: { hostname, effect: "DENY" },
            data: { enabled: false },
          });
          await tx.permissionOverride.create({
            data: { userId: member.id, capability: "project.submit", effect: "DENY" },
          });
          await assert.rejects(reviewProject(tx, owner, project, 1, approve), {
            message: "authorCannotPublish",
          });
          await tx.permissionOverride.deleteMany({
            where: { userId: member.id, capability: "project.submit" },
          });
          await reviewProject(tx, owner, project, 1, approve);
          await assert.rejects(reviewProject(tx, owner, project, 1, approve), {
            message: "projectReviewConflict",
          });
          const published = (await listPublishedProjects(tx)).find(({ id }) => id === project);
          assert.equal(published?.coverId, coverId);
          assert.equal(published?.targetUrl, `https://${hostname}/work`);

          const direct = await submitProject(tx, owner, submission("Owner project"));
          assert.ok((await listPublishedProjects(tx)).some(({ id }) => id === direct));
          const rejected = await submitProject(tx, member, submission("Rejected project"));
          await reviewProject(
            tx,
            owner,
            rejected,
            1,
            form({ decision: "reject", reason: "More detail needed" }),
          );
          assert.ok(!(await listPublishedProjects(tx)).some(({ id }) => id === rejected));
          const mine = (await listOwnProjects(tx, member, 1)).find(({ id }) => id === rejected);
          assert.equal(mine?.revisions[0].reviews[0].reason, "More detail needed");
          throw rollback;
        },
        { timeout: 30_000 },
      ),
      (error) => error === rollback,
    );
  } finally {
    await db.$disconnect();
  }
});

test("project site rules are owner-only, auditable, and applied from the database", async () => {
  const db = getDb();
  const rollback = new Error("ROLLBACK_PROJECT_RULES_TEST");
  const nonce = randomUUID();
  const owner: Actor = { id: nonce, role: "OWNER", banned: false, overrides: {} };
  const member: Actor = { ...owner, role: "MEMBER", overrides: { "site.manage": "ALLOW" } };
  const domain = `example.test-${nonce}`;
  try {
    await assert.rejects(
      db.$transaction(async (tx) => {
        const create = (hostname: string, effect: "ALLOW" | "DENY", include = false) =>
          form({ scope: "create", hostname, effect, ...(include && { includeSubdomains: "on" }) });
        await assert.rejects(saveProjectSiteRule(tx, member, create(domain, "ALLOW")), {
          message: "ownerOnly",
        });
        assert.throws(() => listProjectSiteRules(tx, member), { message: "ownerOnly" });
        await assert.rejects(saveProjectSiteRule(tx, owner, create(`https://${domain}`, "ALLOW")), {
          message: "invalidProjectHostname",
        });
        assert.equal(await checkProjectWebsite(tx, `https://${domain}`), "unmatched");
        await saveProjectSiteRule(tx, owner, create(`${domain.toUpperCase()}.`, "ALLOW", true));
        await assert.rejects(saveProjectSiteRule(tx, owner, create(domain, "ALLOW")), {
          message: "projectRuleExists",
        });
        await saveProjectSiteRule(tx, owner, create(`private.${domain}`, "DENY"));
        const rules = await listProjectSiteRules(tx, owner);
        const deny = rules.find((rule) => rule.hostname === `private.${domain}`)!;
        assert.ok(rules.some((rule) => rule.hostname === domain && rule.includeSubdomains));
        assert.equal(await checkProjectWebsite(tx, `https://public.${domain}/project`), "allowed");
        assert.equal(await checkProjectWebsite(tx, `https://private.${domain}/project`), "denied");
        assert.equal(await checkProjectWebsite(tx, `https://fake${domain}/project`), "unmatched");
        const disable = form({
          scope: "update",
          id: deny.id,
          expectedEnabled: "true",
          expectedSubdomains: "false",
        });
        await saveProjectSiteRule(tx, owner, disable);
        await assert.rejects(saveProjectSiteRule(tx, owner, disable), {
          message: "projectRuleConflict",
        });
        assert.equal(await checkProjectWebsite(tx, `https://private.${domain}/project`), "allowed");
        const audit = await tx.auditLog.findMany({ where: { actorId: owner.id } });
        assert.equal(audit.length, 3);
        assert.ok(
          audit.some(
            (item) => item.action === "project.updateSiteRule" && item.targetId === deny.id,
          ),
        );
        throw rollback;
      }),
      (error) => error === rollback,
    );
  } finally {
    await db.$disconnect();
  }
});
