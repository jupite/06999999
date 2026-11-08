"use client";

import { useI18n, type Notice } from "@/i18n/client";
import type { MessageKey } from "@/i18n/messages";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { saveDraftAction } from "@/app/write/actions";
import { submitArticleEditAction } from "@/app/articles/actions";
import { SubmitArticleButton } from "./article-controls";

type Draft = { id?: string; version: number; title: string; markdown: string };
export function MarkdownEditor({
  initialDraft,
  owner,
  canSubmit,
  publishedEdit = false,
}: {
  initialDraft: Draft;
  owner: boolean;
  canSubmit: boolean;
  publishedEdit?: boolean;
}) {
  const { t, notice } = useI18n();
  const [draft, setDraft] = useState(initialDraft);
  const [dirty, setDirty] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<MessageKey | "">("");
  const [error, setError] = useState<Notice | null>(null);
  const [pending, startTransition] = useTransition();
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
  return (
    <>
      <div className="editor-toolbar">
        <Link
          href={publishedEdit ? `/my-articles/${draft.id}` : "/my-articles?status=draft"}
          onClick={(event) => {
            if (dirty && !window.confirm(t("unsavedConfirm"))) event.preventDefault();
          }}
        >
          {publishedEdit ? t("backToStatus") : t("backToDrafts")}
        </Link>
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
          if (pending || publishing) return;
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
                router.replace(
                  result.state === "PUBLISHED"
                    ? `/articles/${result.slug}`
                    : `/my-articles/${result.id}`,
                );
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
                router.replace(`/write?id=${encodeURIComponent(result.draft.id)}`, {
                  scroll: false,
                });
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
            disabled={pending || publishing}
            placeholder={t("titlePlaceholder")}
            onChange={(e) => edit({ title: e.target.value })}
          />
        </label>
        <div className="editor-grid">
          <label className="panel editor-input">
            <span className="eyebrow">MARKDOWN</span>
            <textarea
              aria-label={t("markdownBody")}
              maxLength={100000}
              disabled={pending || publishing}
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
                  img: () => <span className="notice">{t("imagePreviewUnavailable")}</span>,
                }}
              >
                {draft.markdown}
              </ReactMarkdown>
            </div>
          </section>
        </div>
        <div className="editor-toolbar">
          {publishedEdit ? (
            <button className="button" type="submit" disabled={pending || !dirty || !canSubmit}>
              {pending ? t("submitting") : owner ? t("publishEdit") : t("submitEdit")}
            </button>
          ) : (
            <>
              <button className="button" disabled={pending || publishing} type="submit">
                {pending ? t("saving") : t("saveDraft")}
              </button>
              <SubmitArticleButton
                id={draft.id}
                version={draft.version}
                owner={owner}
                disabled={dirty || pending || publishing || !canSubmit}
                onBusyChange={setPublishing}
              />
            </>
          )}
          {!draft.id && (
            <button
              className="button secondary"
              type="button"
              disabled={pending || publishing}
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
