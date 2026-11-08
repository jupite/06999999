import Link from "next/link";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { listMyArticles } from "@/server/services/articles";
import {
  articlePage,
  articleStateLabels,
  articleFilter,
  articleFilters,
} from "@/server/domain/articles";
import { authorize } from "@/server/domain/permissions";
import {
  ArticlePagination,
  ArticleAccessNotice,
  ArticleNavigation,
} from "@/components/article-shared";
import { DeletePublishedArticleButton } from "@/components/article-controls";
import { DeleteDraftButton } from "@/components/delete-draft-button";
export const dynamic = "force-dynamic";
export const metadata = { title: "我的文章" };
export default async function MyArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const actor = await currentActor();
  if (!actor || actor.banned)
    return (
      <>
        <ArticleNavigation active="mine" />
        <ArticleAccessNotice
          signedIn={!!actor}
          reason={actor ? "账号已封禁" : "登录后查看自己的草稿和投稿。"}
        />
      </>
    );
  const query = await searchParams;
  const page = articlePage(query.page),
    status = articleFilter(query.status);
  const articles = await listMyArticles(getDb(), actor, page, status);
  const canEdit = authorize(actor, "content.editOwn").allowed;
  return (
    <>
      <div className="page-heading">
        <h1>我的文章</h1>
        <p>在这里统一查看草稿、审核结果和已发布文章。</p>
        <ArticleNavigation active="mine" />
      </div>
      <nav className="article-filters" aria-label="文章状态筛选">
        {Object.entries(articleFilters).map(([value, label]) => (
          <Link
            key={value}
            href={`/my-articles?status=${value}`}
            className={value === status ? "button" : "button secondary"}
            aria-current={value === status ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="draft-list">
        {articles.slice(0, 20).map((article) => {
          const revision = article.revisions[0];
          return (
            revision && (
              <article className="panel draft-card" key={article.id}>
                <h2>{revision.title}</h2>
                <p>{articleStateLabels[revision.state]}</p>
                <div className="draft-actions">
                  <Link
                    className="button secondary"
                    href={
                      revision.state === "DRAFT"
                        ? `/write?id=${article.id}`
                        : `/my-articles/${article.id}`
                    }
                  >
                    {revision.state === "DRAFT"
                      ? "继续编辑"
                      : revision.state === "PUBLISHED"
                        ? "查看文章"
                        : "查看投稿"}
                  </Link>
                  {canEdit && revision.state === "DRAFT" && (
                    <DeleteDraftButton
                      id={article.id}
                      version={article.currentVersion}
                      title={revision.title}
                    />
                  )}
                  {canEdit && revision.state === "PUBLISHED" && (
                    <DeletePublishedArticleButton
                      id={article.id}
                      version={article.currentVersion}
                      title={revision.title}
                    />
                  )}
                </div>
              </article>
            )
          );
        })}
      </div>
      {!articles.length && (
        <section className="panel empty-state">
          <h2>暂无{status === "all" ? "文章" : articleFilters[status]}</h2>
          <p>可以切换筛选，或点击“写文章”开始创作。</p>
        </section>
      )}
      <ArticlePagination
        page={page}
        more={articles.length > 20}
        base={`/my-articles?status=${status}`}
      />
    </>
  );
}
