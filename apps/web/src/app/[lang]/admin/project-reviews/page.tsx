import { ArticleAccessNotice, ArticlePagination } from "@/components/server";
import { ArticleImage, ProjectReviewForm } from "@/components";
import { LocaleLink } from "@/i18n/link";
import { getI18n } from "@/i18n/server";
import { imageUrl } from "@/media/urls";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { articlePage } from "@/server/domain/articles";
import { authorize } from "@/server/domain/permissions";
import { parseProjectUrl } from "@/server/domain/project-sites";
import { listPendingProjects } from "@/server/services/projects";

export const dynamic = "force-dynamic";

export default async function ProjectReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { t, system } = await getI18n();
  const actor = await currentActor();
  const access = authorize(actor, "site.manage");
  if (!access.allowed)
    return <ArticleAccessNotice signedIn={!!actor} reason={system(access.reason)} />;
  const page = articlePage((await searchParams).page);
  const projects = await listPendingProjects(getDb(), actor, page);
  return (
    <>
      <LocaleLink href="/admin">{t("backToAdmin")}</LocaleLink>
      <div className="page-heading">
        <h1>{t("projectReviews")}</h1>
        <p>{t("projectReviewsHelp")}</p>
      </div>
      <div className="draft-list">
        {projects.slice(0, 20).map((project) => {
          const revision = project.revisions[0];
          if (!revision || revision.state !== "PENDING_HUMAN") return null;
          const url = parseProjectUrl(revision.targetUrl);
          const cover = revision.media[0];
          return (
            <article className="panel draft-card" key={project.id}>
              <h2>{revision.title}</h2>
              <p>{t("authorLabel", { author: project.author.name })}</p>
              <p className="project-summary">{revision.summary}</p>
              {url && (
                <p>
                  <a
                    className="text-link"
                    href={url.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {url.href}
                  </a>
                </p>
              )}
              {cover && (
                <div className="project-cover">
                  <ArticleImage src={imageUrl(cover.id)} unavailable={t("imagesUnavailable")} />
                </div>
              )}
              <ProjectReviewForm id={project.id} version={revision.version} />
            </article>
          );
        })}
      </div>
      {!projects.length && (
        <section className="panel empty-state">
          <h2>{t("projectReviewsEmpty")}</h2>
        </section>
      )}
      <ArticlePagination page={page} more={projects.length > 20} base="/admin/project-reviews" />
    </>
  );
}
