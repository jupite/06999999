import { getI18n } from "@/i18n/server";
import { LocaleLink } from "@/i18n/link";
import { ArticleNavigation } from "@/components/article-shared";
import { notFound } from "next/navigation";
import { MarkdownEditor } from "@/components/markdown-editor";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { authorize } from "@/server/domain/permissions";
import { readDraft } from "@/server/services/drafts";
import { readMyArticle } from "@/server/services/articles";
export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("articleEditor") };
}
export const dynamic = "force-dynamic";
export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const { t, system } = await getI18n();
  const actor = await currentActor();
  const { id } = await searchParams;
  const access = authorize(actor, id ? "content.editOwn" : "post.submit");
  if (!actor || !access.allowed)
    return (
      <section className="panel empty-state">
        <h1>{t("articleDraft")}</h1>
        <p>{system(access.reason)}</p>
        <LocaleLink className="button" href="/login">
          {actor ? t("viewAccountShort") : t("goLogin")}
        </LocaleLink>
      </section>
    );
  if (id !== undefined && (typeof id !== "string" || !id || id.length > 100)) notFound();
  const canSubmit = authorize(actor, "post.submit").allowed;
  let draft = id ? await readDraft(getDb(), actor, id) : { version: 0, title: "", markdown: "" };
  let publishedEdit = false;
  if (!draft) {
    const submitted = id ? await readMyArticle(getDb(), actor, id) : null;
    if (!submitted) notFound();
    const revision = submitted.revisions[0];
    if (
      submitted.publishedVersion !== null &&
      (revision?.state === "PUBLISHED" || revision?.state === "REJECTED")
    ) {
      draft = {
        id: submitted.id,
        version: submitted.currentVersion,
        title: revision.title,
        markdown: revision.markdown,
      };
      publishedEdit = true;
    } else {
      return (
        <section className="panel empty-state">
          <h1>{t("alreadySubmitted")}</h1>
          <p>{t("checkArticleStatus")}</p>
          <LocaleLink className="button" href={`/my-articles/${submitted.id}`}>
            {t("viewArticleStatus")}
          </LocaleLink>
        </section>
      );
    }
  }
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">A SPACE FOR YOUR THOUGHTS</span>
        <h1>
          {publishedEdit ? t("editPublished") : t("writeHeading")}
          <span className="brand-dot">.</span>
        </h1>
        <p>{publishedEdit ? t("editDescription") : t("writeDescription")}</p>
        <ArticleNavigation active={publishedEdit ? "mine" : "write"} />
      </div>
      <MarkdownEditor
        key={publishedEdit ? `${id}-edit` : (id ?? "new")}
        initialDraft={draft}
        owner={actor.role === "OWNER"}
        canSubmit={canSubmit}
        publishedEdit={publishedEdit}
      />
    </>
  );
}
