import { ContentWithdrawal } from "@/components";
import { authorize } from "@/server/domain/permissions";
import { ArticleAccessNotice, ArticlePagination } from "@/components/server";
import { LocaleLink } from "@/i18n/link";
import { getI18n } from "@/i18n/server";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { articlePage, articleStateLabels } from "@/server/domain/articles";
import { parseProjectUrl } from "@/server/domain/project-sites";
import { listOwnProjects } from "@/server/services/projects";

export const dynamic = "force-dynamic";

export default async function OwnProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; submitted?: string }>;
}) {
  const { t, system } = await getI18n();
  const actor = await currentActor();
  if (!actor || actor.banned)
    return (
      <ArticleAccessNotice
        signedIn={!!actor}
        reason={system(actor ? "accountBanned" : "loginRequired")}
      />
    );
  const query = await searchParams;
  const page = articlePage(query.page);
  const projects = await listOwnProjects(getDb(), actor, page);
  return (
    <>
      <LocaleLink href="/projects">{t("backToProjects")}</LocaleLink>
      <div className="page-heading">
        <h1>{t("myProjects")}</h1>
        <LocaleLink className="button" href="/projects/submit">
          {t("submitProject")}
        </LocaleLink>
      </div>
      {query.submitted === "1" && <p role="status">{t("projectSubmissionSaved")}</p>}
      <div className="draft-list">
        {projects.slice(0, 20).map((project) => {
          const revision = project.revisions[0];
          if (!revision) return null;
          const url = parseProjectUrl(revision.targetUrl);
          return (
            <article className="panel draft-card" key={project.id}>
              <h2>{revision.title}</h2>
              <p>{t("statusLabel", { status: t(articleStateLabels[revision.state]) })}</p>
              <p className="project-summary">{revision.summary}</p>
              {authorize(actor, "content.editOwn").allowed &&
                (revision.state === "PENDING_HUMAN" || revision.state === "PUBLISHED") && (
                  <ContentWithdrawal
                    id={project.id}
                    version={revision.version}
                    kind="PROJECT"
                    state={revision.state}
                    title={revision.title}
                  />
                )}
              {revision.state === "REJECTED" && (
                <p className="notice">
                  {t("rejectionReason", {
                    reason: revision.reviews[0]?.reason || t("rejectionReasonFallback"),
                  })}
                </p>
              )}
              {revision.state === "PUBLISHED" && url && (
                <a
                  className="button secondary"
                  href={url.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("openProjectWebsite")}
                </a>
              )}
            </article>
          );
        })}
      </div>
      {!projects.length && (
        <section className="panel empty-state">
          <h2>{t("ownProjectsEmpty")}</h2>
        </section>
      )}
      <ArticlePagination page={page} more={projects.length > 20} base="/projects/mine" />
    </>
  );
}
