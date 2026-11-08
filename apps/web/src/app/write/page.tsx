import Link from "next/link";
import { ArticleNavigation } from "@/components/article-shared";
import { notFound } from "next/navigation";
import { MarkdownEditor } from "@/components/markdown-editor";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { authorize } from "@/server/domain/permissions";
import { readDraft } from "@/server/services/drafts";
import { readMyArticle } from "@/server/services/articles";
export const metadata = { title: "文章草稿" };
export const dynamic = "force-dynamic";
export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const actor = await currentActor();
  const { id } = await searchParams;
  const access = authorize(actor, id ? "content.editOwn" : "post.submit");
  if (!actor || !access.allowed)
    return (
      <section className="panel empty-state">
        <h1>文章草稿</h1>
        <p>{access.reason}</p>
        <Link className="button" href="/login">
          {actor ? "查看账户" : "前往登录"}
        </Link>
      </section>
    );
  if (id !== undefined && (typeof id !== "string" || !id || id.length > 100)) notFound();
  const draft = id ? await readDraft(getDb(), actor, id) : { version: 0, title: "", markdown: "" };
  if (!draft) {
    const submitted = id ? await readMyArticle(getDb(), actor, id) : null;
    if (!submitted) notFound();
    return (
      <section className="panel empty-state">
        <h1>这篇文章已提交</h1>
        <p>当前版本已不在草稿中，请到我的文章查看发布或审核状态。</p>
        <Link className="button" href={`/my-articles/${submitted.id}`}>
          查看文章状态
        </Link>
      </section>
    );
  }
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">A SPACE FOR YOUR THOUGHTS</span>
        <h1>
          写下此刻<span className="brand-dot">.</span>
        </h1>
        <p>从一句话开始，不必急着完成。</p>
        <ArticleNavigation active="write" />
      </div>
      <MarkdownEditor
        key={id ?? "new"}
        initialDraft={draft}
        owner={actor.role === "OWNER"}
        canSubmit={authorize(actor, "post.submit").allowed}
      />
    </>
  );
}
