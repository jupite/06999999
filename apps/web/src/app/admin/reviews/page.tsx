import Link from "next/link";
import { currentActor } from "@/server/auth";
import { authorize } from "@/server/domain/permissions";
import { getDb } from "@/server/db";
import { listPendingArticles } from "@/server/services/articles";
import { articlePage } from "@/server/domain/articles";
import { ArticleAccessNotice, ArticlePagination } from "@/components/article-shared";
export const dynamic = "force-dynamic";
export const metadata = { title: "文章审核" };
export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const actor = await currentActor();
  const access = authorize(actor, "site.manage");
  if (!access.allowed) return <ArticleAccessNotice signedIn={!!actor} reason={access.reason} />;
  const page = articlePage((await searchParams).page);
  const articles = await listPendingArticles(getDb(), actor, page);
  return (
    <>
      <Link href="/admin">← 管理后台</Link>
      <div className="page-heading">
        <h1>文章审核</h1>
        <p>当前普通用户投稿进入人工审核。通过后立即公开，拒绝时请填写原因。</p>
      </div>
      <div className="draft-list">
        {articles.slice(0, 20).map((article) => (
          <article key={article.id} className="panel draft-card">
            <h2>{article.revisions[0]?.title}</h2>
            <p>
              作者：{article.author.name}
              {article.author.banned ? "（已封禁）" : ""}
            </p>
            <Link className="button" href={`/admin/reviews/${article.id}`}>
              阅读并审核
            </Link>
          </article>
        ))}
      </div>
      {!articles.length && (
        <section className="panel empty-state">
          <h2>暂无待审核文章</h2>
        </section>
      )}
      <ArticlePagination page={page} more={articles.length > 20} base="/admin/reviews" />
    </>
  );
}
