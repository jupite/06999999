import { ArrowUpRight } from "lucide-react";
import { ArticlePagination } from "@/components/article-shared";
import { ArticleImage } from "@/components/article-image";
import { LocaleLink } from "@/i18n/link";
import { getI18n } from "@/i18n/server";
import { imageUrl } from "@/media/urls";
import { getDb } from "@/server/db";
import { articlePage } from "@/server/domain/articles";
import { parseProjectUrl } from "@/server/domain/project-sites";
import { listPublishedProjects } from "@/server/services/projects";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("projects") };
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { t } = await getI18n();
  const page = articlePage((await searchParams).page);
  const projects = process.env.DATABASE_URL ? await listPublishedProjects(getDb(), page) : [];

  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">SMALL IDEAS, REAL THINGS</span>
        <h1>
          {t("projects")}
          <span className="brand-dot">.</span>
        </h1>
        <p>{t("projectsDescription")}</p>
        <div className="draft-actions">
          <LocaleLink className="button" href="/projects/submit">
            {t("submitProject")}
          </LocaleLink>
          <LocaleLink className="button secondary" href="/projects/mine">
            {t("myProjects")}
          </LocaleLink>
        </div>
      </div>
      {projects.length ? (
        <div className="project-catalog">
          {projects.slice(0, 20).map((project) => {
            const url = parseProjectUrl(project.targetUrl);
            if (!url) return null;
            return (
              <a
                className="panel draft-card project-entry"
                key={project.id}
                href={url.href}
                target="_blank"
                rel="ugc noopener noreferrer"
              >
                {project.coverId && (
                  <div className="project-cover">
                    <ArticleImage
                      src={imageUrl(project.coverId)}
                      unavailable={t("imagesUnavailable")}
                    />
                  </div>
                )}
                <h2>{project.title}</h2>
                <p className="project-summary">{project.summary}</p>
                <p className="muted">
                  {t("authorLabel", { author: project.authorName })} · {url.hostname}
                </p>
                <span className="card-action">
                  {t("openProjectWebsite")} <ArrowUpRight size={16} />
                </span>
              </a>
            );
          })}
        </div>
      ) : (
        <section className="panel empty-state">
          <h2>{t("projectsEmpty")}</h2>
          <p>{t("projectsDetail")}</p>
        </section>
      )}
      <ArticlePagination page={page} more={projects.length > 20} base="/projects" />
    </>
  );
}
