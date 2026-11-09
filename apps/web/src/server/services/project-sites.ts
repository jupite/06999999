import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { SystemKey } from "@/i18n/messages";
import { authorize, type Actor } from "../domain/permissions";
import { normalizeSiteHostname, projectUrlDecision } from "../domain/project-sites";

type Db = Prisma.TransactionClient;

export class ProjectSiteError extends Error {
  readonly key: SystemKey;

  constructor(key: SystemKey) {
    super(key);
    this.key = key;
  }
}

function requireSiteOwner(actor: Actor | null) {
  const access = authorize(actor, "site.manage");
  if (!actor || !access.allowed) throw new ProjectSiteError(access.reason);
  return actor;
}

export function listProjectSiteRules(db: Db, actor: Actor | null) {
  requireSiteOwner(actor);
  return db.projectSiteRule.findMany({ orderBy: [{ hostname: "asc" }, { effect: "asc" }] });
}

// Shared with the project submission workflow when it is enabled.
export async function checkProjectWebsite(db: Db, value: unknown) {
  const rules = await db.projectSiteRule.findMany({ where: { enabled: true } });
  return projectUrlDecision(value, rules);
}

export async function saveProjectSiteRule(tx: Db, actor: Actor | null, form: FormData) {
  const manager = requireSiteOwner(actor);
  const scope = form.get("scope");
  const includeSubdomains = form.get("includeSubdomains") === "on";

  if (scope === "create") {
    const hostname = normalizeSiteHostname(form.get("hostname"));
    const effect = form.get("effect");
    if (!hostname) throw new ProjectSiteError("invalidProjectHostname");
    if (effect !== "ALLOW" && effect !== "DENY") throw new ProjectSiteError("invalidProjectRule");

    const [rule] = await tx.projectSiteRule.createManyAndReturn({
      data: { hostname, effect, includeSubdomains, enabled: true },
      skipDuplicates: true,
    });
    if (!rule) throw new ProjectSiteError("projectRuleExists");
    await tx.auditLog.create({
      data: {
        actorId: manager.id,
        action: "project.createSiteRule",
        targetId: rule.id,
        after: { hostname, effect, includeSubdomains, enabled: true },
      },
    });
    return;
  }

  const id = form.get("id");
  const expectedEnabled = form.get("expectedEnabled");
  const expectedSubdomains = form.get("expectedSubdomains");
  if (
    scope !== "update" ||
    typeof id !== "string" ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(id) ||
    (expectedEnabled !== "true" && expectedEnabled !== "false") ||
    (expectedSubdomains !== "true" && expectedSubdomains !== "false")
  )
    throw new ProjectSiteError("invalidProjectRule");

  const before = {
    enabled: expectedEnabled === "true",
    includeSubdomains: expectedSubdomains === "true",
  };
  const after = { enabled: form.get("enabled") === "on", includeSubdomains };
  const result = await tx.projectSiteRule.updateMany({ where: { id, ...before }, data: after });
  if (result.count !== 1) throw new ProjectSiteError("projectRuleConflict");
  if (before.enabled === after.enabled && before.includeSubdomains === after.includeSubdomains)
    return;
  await tx.auditLog.create({
    data: {
      actorId: manager.id,
      action: "project.updateSiteRule",
      targetId: id,
      before,
      after,
    },
  });
}
