import Link from "next/link";

import { currentActor } from "@/server/auth";
import { authorize } from "@/server/domain/permissions";
import { getDb } from "@/server/db";
import { readPendingArticle } from "@/server/services/articles";
import { ArticleAccessNotice } from "@/components/article-shared";
import { ArticleBody } from "@/components/article-body";
import { ReviewArticleForm } from "@/components/article-controls";
export const dynamic = "force-dynamic";
export const metadata = { title: "审核投稿" };
export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  const access = authorize(actor, "site.manage");
  if (!access.allowed) return <ArticleAccessNotice signedIn={!!actor} reason={access.reason} />;
  const article = await readPendingArticle(getDb(), actor, (await params).id);
  if (!article)
    return (
      <section className="panel empty-state">
        <h1>该投稿已处理或不存在</h1>
        <Link className="button" href="/admin/reviews">
          返回待审核列表
        </Link>
      </section>
    );
  const revision = article.revisions[0];
  return (
    <>
      <Link href="/admin/reviews">← 返回待审核列表</Link>
      <article className="panel draft-card">
        <h1>{revision.title}</h1>
        <p>
          作者：{article.author.name} · 版本 {revision.version}
        </p>
        {article.author.banned && <p className="notice">作者已被封禁，不能通过发布。</p>}
        <ArticleBody markdown={revision.markdown} />
      </article>
      <ReviewArticleForm id={article.id} version={revision.version} />
    </>
  );
}
