import Link from "next/link";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { listMyArticles } from "@/server/services/articles";
import { articlePage, articleStateLabels } from "@/server/domain/articles";
import { ArticlePagination, ArticleAccessNotice } from "@/components/article-shared";
export const dynamic = "force-dynamic";
export const metadata = { title: "我的文章" };
export default async function MyArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const actor = await currentActor();
  if (!actor || actor.banned)
    return (
      <ArticleAccessNotice
        signedIn={!!actor}
        reason={actor ? "账号已封禁" : "登录后查看自己的草稿和投稿。"}
      />
    );
  const page = articlePage((await searchParams).page);
  const articles = await listMyArticles(getDb(), actor, page);
  return (
    <>
      <div className="page-heading">
        <h1>我的文章</h1>
        <p>查看草稿、审核结果与已发布文章。</p>
        <div className="draft-actions">
          <Link className="button" href="/write">
            新建文章
          </Link>
          <Link className="button secondary" href="/drafts">
            我的草稿
          </Link>
        </div>
      </div>
      <div className="draft-list">
        {articles.slice(0, 20).map((article) => {
          const revision = article.revisions[0];
          return (
            revision && (
              <article className="panel draft-card" key={article.id}>
                <h2>{revision.title}</h2>
                <p>{articleStateLabels[revision.state]}</p>
                <Link
                  className="button secondary"
                  href={
                    revision.state === "DRAFT"
                      ? `/write?id=${article.id}`
                      : `/my-articles/${article.id}`
                  }
                >
                  {revision.state === "DRAFT" ? "继续编辑" : "查看投稿"}
                </Link>
              </article>
            )
          );
        })}
      </div>
      {!articles.length && <p>还没有文章，先保存一份草稿吧。</p>}
      <ArticlePagination page={page} more={articles.length > 20} base="/my-articles" />
    </>
  );
}
