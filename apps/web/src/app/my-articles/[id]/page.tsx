import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { readMyArticle } from "@/server/services/articles";
import { articleStateLabels } from "@/server/domain/articles";
import { ArticleBody } from "@/components/article-body";
import { ArticleAccessNotice, ArticleNavigation } from "@/components/article-shared";
import { CopyRejectedButton } from "@/components/article-controls";
export const dynamic = "force-dynamic";
export const metadata = { title: "我的投稿" };
export default async function MyArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor || actor.banned)
    return <ArticleAccessNotice signedIn={!!actor} reason={actor ? "账号已封禁" : "请先登录"} />;
  const article = await readMyArticle(getDb(), actor, (await params).id);
  if (!article || !article.revisions[0]) notFound();
  const revision = article.revisions[0];
  return (
    <>
      <ArticleNavigation active="mine" />
      <section className="panel draft-card">
        <h1>{revision.title}</h1>
        <p>状态：{articleStateLabels[revision.state]}</p>
        {revision.state === "PENDING_HUMAN" && <p>投稿已保存，等待站主人工审核，当前尚未公开。</p>}
        {revision.state === "REJECTED" && (
          <>
            <p className="notice">
              拒绝原因：{revision.reviews[0]?.reason ?? "请联系站主了解审核意见。"}
            </p>
            <CopyRejectedButton id={article.id} version={article.currentVersion} />
            <p>复制后可编辑并重新投稿，原审核记录会保留。</p>
          </>
        )}
        {revision.state === "DRAFT" && (
          <Link className="button" href={`/write?id=${article.id}`}>
            继续编辑
          </Link>
        )}
        {revision.state === "PUBLISHED" && (
          <Link className="button" href={`/articles/${article.slug}`}>
            查看公开文章
          </Link>
        )}
        <ArticleBody markdown={revision.markdown} />
      </section>
    </>
  );
}
