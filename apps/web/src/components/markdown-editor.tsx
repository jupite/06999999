"use client";

import { useI18n, type Notice } from "@/i18n/client";
import { localePath } from "@/i18n/routing";
import type { MessageKey } from "@/i18n/messages";
import { useEffect, useRef, useState, useTransition } from "react";
import { imageUrl } from "@/media/urls";
import { uploadImage } from "@/api";
import { maxTagTextLength } from "@/server/domain/article-taxonomy";
import { LocaleLink } from "@/i18n/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { saveDraftAction } from "@/app/[lang]/write/actions";
import { submitArticleEditAction } from "@/app/[lang]/articles/actions";
import { SubmitArticleButton } from "./article-controls";
import { ArticleImage } from "./article-image";

type Draft = {
  id?: string;
  version: number;
  title: string;
  markdown: string;
  categoryId: string | null;
  tagText: string;
};
const maxMarkdownLength = 100_000;

export function MarkdownEditor({
  initialDraft,
  categories,
  owner,
  canSubmit,
  canUpload,
  publishedEdit = false,
}: {
  initialDraft: Draft;
  categories: { id: string; name: string }[];
  owner: boolean;
  canSubmit: boolean;
  canUpload: boolean;
  publishedEdit?: boolean;
}) {
  const { locale, t, notice } = useI18n();
  const [draft, setDraft] = useState(initialDraft);
  const [dirty, setDirty] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<MessageKey | "">("");
  const [error, setError] = useState<Notice | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = pending || publishing || uploading;
  const router = useRouter();
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function edit(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
    setMessage("");
    setError(null);
  }
  async function upload(file: File) {
    const prefix = `${draft.markdown ? `${draft.markdown}\n\n` : ""}![${t("imageAlt")}](`;
    if (prefix.length + imageUrl("x".repeat(36)).length + 2 > maxMarkdownLength) {
      setError({ system: "draftBodyTooLong" });
      return;
    }
    setUploading(true);
    setError(null);
    setMessage("");
    try {
      const result = await uploadImage(file);
      if ("error" in result) {
        setError({ system: result.error });
        return;
      }
      edit({ markdown: `${prefix}${result.url})\n` });
      setMessage("imageInserted");
    } catch {
      setError("imageUploadNetworkError");
    } finally {
      setUploading(false);
    }
  }
  return (
    <>
      <div className="editor-toolbar">
        <LocaleLink
          href={publishedEdit ? `/my-articles/${draft.id}` : "/my-articles?status=draft"}
          onClick={(event) => {
            if (dirty && !window.confirm(t("unsavedConfirm"))) event.preventDefault();
          }}
        >
          {publishedEdit ? t("backToStatus") : t("backToDrafts")}
        </LocaleLink>
        <span>
          {dirty
            ? t("unsaved")
            : publishedEdit
              ? t("currentVersion")
              : draft.id
                ? t("saved")
                : t("newDraft")}
        </span>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          if (
            publishedEdit &&
            (!dirty ||
              !canSubmit ||
              !window.confirm(owner ? t("confirmPublishEdit") : t("confirmSubmitEdit")))
          )
            return;
          setError(null);
          setMessage("");
          startTransition(async () => {
            try {
              if (publishedEdit) {
                const result = await submitArticleEditAction(draft);
                if (!result.ok) {
                  setError({ system: result.error });
                  return;
                }
                setDirty(false);
                const path =
                  result.state === "PUBLISHED"
                    ? `/articles/${result.slug}`
                    : `/my-articles/${result.id}`;
                router.replace(localePath(locale, path));
                return;
              }
              const result = await saveDraftAction(draft);
              if (!result.ok) {
                setError({ system: result.error });
                return;
              }
              setDraft(result.draft);
              setDirty(false);
              setMessage("draftSaved");
              if (!draft.id)
                router.replace(
                  localePath(locale, `/write?id=${encodeURIComponent(result.draft.id)}`),
                  {
                    scroll: false,
                  },
                );
            } catch {
              setError(publishedEdit ? "editNetworkError" : "saveNetworkError");
            }
          });
        }}
      >
        <label className="draft-title">
          {t("articleTitle")}
          <input
            required
            maxLength={160}
            value={draft.title}
            disabled={busy}
            placeholder={t("titlePlaceholder")}
            onChange={(e) => edit({ title: e.target.value })}
          />
        </label>
        <div className="article-taxonomy-fields">
          <label className="draft-title">
            {t("articleCategory")}
            <select
              value={draft.categoryId ?? ""}
              disabled={busy}
              onChange={(event) => edit({ categoryId: event.target.value || null })}
            >
              <option value="">{t("noArticleCategory")}</option>
              {categories.map(({ id, name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="draft-title">
            {t("articleTags")}
            <input
              value={draft.tagText}
              maxLength={maxTagTextLength}
              disabled={busy}
              placeholder={t("articleTagsPlaceholder")}
              onChange={(event) => edit({ tagText: event.target.value })}
            />
          </label>
        </div>
        <div className="editor-grid">
          <label className="panel editor-input">
            <span className="eyebrow">MARKDOWN</span>
            <textarea
              aria-label={t("markdownBody")}
              maxLength={maxMarkdownLength}
              disabled={busy}
              value={draft.markdown}
              onChange={(e) => edit({ markdown: e.target.value })}
            />
          </label>
          <section className="panel editor-preview">
            <span className="eyebrow">{t("preview")}</span>
            <div className="prose">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                skipHtml
                components={{
                  img: ({ src, alt, title }) => (
                    <ArticleImage
                      src={src}
                      alt={alt}
                      title={title}
                      unavailable={t("imagesUnavailable")}
                    />
                  ),
                }}
              >
                {draft.markdown}
              </ReactMarkdown>
            </div>
          </section>
        </div>
        <div className="editor-toolbar">
          {canUpload && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file && !busy) void upload(file);
                }}
              />
              <button
                className="button secondary"
                type="button"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                {uploading ? t("imageUploading") : t("uploadImage")}
              </button>
            </>
          )}
          {publishedEdit ? (
            <button className="button" type="submit" disabled={busy || !dirty || !canSubmit}>
              {pending ? t("submitting") : owner ? t("publishEdit") : t("submitEdit")}
            </button>
          ) : (
            <>
              <button className="button" disabled={busy} type="submit">
                {pending ? t("saving") : t("saveDraft")}
              </button>
              <SubmitArticleButton
                id={draft.id}
                version={draft.version}
                owner={owner}
                disabled={dirty || busy || !canSubmit}
                onBusyChange={setPublishing}
              />
            </>
          )}
          {!draft.id && (
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={() => {
                if (dirty && !window.confirm(t("importConfirm"))) return;
                try {
                  const old = localStorage.getItem("site:editor-demo");
                  if (old) {
                    edit({ markdown: old });
                    setMessage("draftImported");
                  } else setMessage("noLocalDraft");
                } catch {
                  setError("importFailed");
                }
              }}
            >
              {t("importDraft")}
            </button>
          )}
        </div>
      </form>
      {message && <p role="status">{t(message)}</p>}
      {error && (
        <p className="notice" role="alert">
          {notice(error)}
        </p>
      )}
      <p className="muted">
        {publishedEdit ? (owner ? t("publishEditHelp") : t("submitEditHelp")) : t("draftHelp")}
      </p>
    </>
  );
}
