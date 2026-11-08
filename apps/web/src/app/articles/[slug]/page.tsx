import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/server/db";
import { readPublishedArticle } from "@/server/services/articles";
import { ArticleBody } from "@/components/article-body";
import { ArticleTime } from "@/components/article-shared";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const article = await readPublishedArticle(getDb(), (await params).slug);
  return { title: article?.title ?? "文章不存在" };
}
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const article = await readPublishedArticle(getDb(), (await params).slug);
  if (!article) notFound();
  return (
    <>
      <Link href="/articles">← 返回文章列表</Link>
      <article className="panel draft-card">
        <h1>{article.title}</h1>
        <p>
          作者：{article.authorName} · 发布于 <ArticleTime value={article.publishedAt} />
        </p>
        <ArticleBody markdown={article.markdown} />
      </article>
    </>
  );
}
