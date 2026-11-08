import Link from "next/link";
import { getDb } from "@/server/db";
import { listPublishedArticles } from "@/server/services/articles";
import { articlePage } from "@/server/domain/articles";
import { ArticlePagination, ArticleTime } from "@/components/article-shared";
export const dynamic = "force-dynamic";
export const metadata = { title: "文章" };
export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = articlePage((await searchParams).page);
  const articles = await listPublishedArticles(getDb(), page);
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">WORDS THAT STAY</span>
        <h1>
          文章<span className="brand-dot">.</span>
        </h1>
        <p>把思考写下来，把时间留住。</p>
        <div className="draft-actions">
          <Link className="button" href="/write">
            写文章
          </Link>
          <Link className="button secondary" href="/my-articles">
            我的文章
          </Link>
          <Link className="button secondary" href="/drafts">
            我的草稿
          </Link>
        </div>
      </div>
      <div className="draft-list">
        {articles.slice(0, 20).map((article) => (
          <article key={article.slug} className="panel draft-card">
            <h2>
              <Link href={`/articles/${article.slug}`}>{article.title}</Link>
            </h2>
            <p>
              作者：{article.authorName} · 发布于 <ArticleTime value={article.publishedAt} />
            </p>
            <Link className="button secondary" href={`/articles/${article.slug}`}>
              阅读全文
            </Link>
          </article>
        ))}
      </div>
      {!articles.length && (
        <section className="panel empty-state">
          <h2>这里还没有已发布的文章</h2>
          <p>草稿和待审核投稿不会出现在这里。</p>
        </section>
      )}
      <ArticlePagination page={page} more={articles.length > 20} base="/articles" />
    </>
  );
}
