import { ArticleAccessNotice } from "@/components/article-shared";
import { LocaleLink } from "@/i18n/link";
import { getI18n } from "@/i18n/server";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { authorize } from "@/server/domain/permissions";
import { listProjectSiteRules } from "@/server/services/project-sites";
import { updateProjectSite } from "./actions";
import { SiteChecker } from "./site-checker";

export const dynamic = "force-dynamic";

export default async function ProjectSitesPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const { locale, t, system } = await getI18n();
  const actor = await currentActor();
  const access = authorize(actor, "site.manage");
  if (!access.allowed)
    return <ArticleAccessNotice signedIn={!!actor} reason={system(access.reason)} />;

  const rules = await listProjectSiteRules(getDb(), actor);
  const { result } = await searchParams;
  const error =
    result === "invalidProjectHostname" ||
    result === "invalidProjectRule" ||
    result === "projectRuleExists" ||
    result === "projectRuleConflict" ||
    result === "projectRuleSaveFailed"
      ? system(result)
      : null;
  const action = updateProjectSite.bind(null, locale);

  return (
    <>
      <LocaleLink href="/admin">{t("backToAdmin")}</LocaleLink>
      <div className="page-heading">
        <h1>{t("projectWebsiteRules")}</h1>
        <p>{t("projectWebsiteRulesHelp")}</p>
      </div>
      {result === "saved" && <p role="status">{t("projectRuleSaved")}</p>}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <div className="draft-list">
        <form action={action} className="panel draft-card">
          <input type="hidden" name="scope" value="create" />
          <h2>{t("addProjectRule")}</h2>
          <div className="article-taxonomy-fields">
            <label className="draft-title">
              {t("projectRuleHostname")}
              <input name="hostname" required maxLength={254} placeholder="example.com" />
            </label>
            <label className="draft-title">
              {t("projectRuleEffect")}
              <select name="effect" defaultValue="ALLOW">
                <option value="ALLOW">{t("permissionAllow")}</option>
                <option value="DENY">{t("permissionDeny")}</option>
              </select>
            </label>
          </div>
          <div className="draft-actions">
            <label>
              <input name="includeSubdomains" type="checkbox" /> {t("includeProjectSubdomains")}
            </label>
            <button className="button" type="submit">
              {t("addProjectRule")}
            </button>
          </div>
        </form>
        <SiteChecker />
        {!rules.length && (
          <section className="panel draft-card">
            <p>{t("projectRulesEmpty")}</p>
          </section>
        )}
        {rules.map((rule) => (
          <form
            key={`${rule.id}:${rule.enabled}:${rule.includeSubdomains}`}
            action={action}
            className="panel draft-card"
          >
            <input type="hidden" name="scope" value="update" />
            <input type="hidden" name="id" value={rule.id} />
            <input type="hidden" name="expectedEnabled" value={String(rule.enabled)} />
            <input type="hidden" name="expectedSubdomains" value={String(rule.includeSubdomains)} />
            <h2>{rule.hostname}</h2>
            <p>{t(rule.effect === "ALLOW" ? "permissionAllow" : "permissionDeny")}</p>
            <div className="draft-actions">
              <label>
                <input
                  name="includeSubdomains"
                  type="checkbox"
                  defaultChecked={rule.includeSubdomains}
                />{" "}
                {t("includeProjectSubdomains")}
              </label>
              <label>
                <input name="enabled" type="checkbox" defaultChecked={rule.enabled} />{" "}
                {t("projectRuleEnabled")}
              </label>
              <button className="button secondary" type="submit">
                {t("saveProjectRule")}
              </button>
            </div>
          </form>
        ))}
      </div>
    </>
  );
}
