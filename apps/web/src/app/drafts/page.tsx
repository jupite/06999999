import Link from "next/link";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { listDrafts } from "@/server/services/drafts";
import { DeleteDraftButton } from "@/components/delete-draft-button";
import { authorize } from "@/server/domain/permissions";
export const metadata = { title: "我的草稿" };
export const dynamic = "force-dynamic";
export default async function DraftsPage() {
  const actor = await currentActor();
  if (!actor || actor.banned)
    return (
      <section className="panel empty-state">
        <h1>我的草稿</h1>
        <Link href="/my-articles">查看我的投稿与审核结果 →</Link>
        <p>{actor ? "账号已封禁" : "请先登录后查看自己的草稿。"}</p>
        <Link className="button" href="/login">
          {actor ? "查看账户" : "前往登录"}
        </Link>
      </section>
    );
  const drafts = await listDrafts(getDb(), actor);
  const canEdit = authorize(actor, "content.editOwn").allowed;
  return (
    <>
      <div className="page-heading">
        <h1>我的草稿</h1>
        <Link href="/my-articles">查看我的投稿与审核结果 →</Link>
        <p>仅自己可见，按最近保存时间排列，最多显示最近 100 篇。</p>
        {authorize(actor, "post.submit").allowed && (
          <Link className="button" href="/write">
            新建文章
          </Link>
        )}
      </div>
      {!drafts.length && (
        <section className="panel empty-state">
          <h2>还没有草稿</h2>
          <p>从一篇旅行游记开始吧。</p>
        </section>
      )}
      <div className="draft-list">
        {drafts.map((draft) => (
          <article key={draft.id} className="panel draft-card">
            <h2>{draft.revisions[0].title}</h2>
            <p>
              最近保存：
              {new Intl.DateTimeFormat("zh-CN", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Taipei",
              }).format(draft.updatedAt)}
              （UTC+8）
            </p>
            {canEdit && (
              <div className="draft-actions">
                <Link className="button" href={`/write?id=${encodeURIComponent(draft.id)}`}>
                  继续编辑
                </Link>
                <DeleteDraftButton
                  id={draft.id}
                  version={draft.currentVersion}
                  title={draft.revisions[0].title}
                />
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
