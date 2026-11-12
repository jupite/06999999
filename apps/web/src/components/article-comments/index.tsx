"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { articleComments, postArticleComment, type CommentPage } from "@/api";
import { LocaleLink } from "@/i18n/link";
import { useI18n } from "@/i18n/client";
import type { SystemKey } from "@/i18n/messages";
export function ArticleComments({
  slug,
  signedIn,
  denied,
}: {
  slug: string;
  signedIn: boolean;
  denied?: SystemKey;
}) {
  const { t, notice, locale } = useI18n();
  const [page, setPage] = useState(1),
    [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<CommentPage | null>(null),
    [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [body, setBody] = useState(""),
    [pending, setPending] = useState(false);
  const [error, setError] = useState<SystemKey | null>(null),
    [saved, setSaved] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadFailed(false);
    setData(null);
    articleComments(slug, page, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [slug, page, refresh]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setSaved(null);
    requestId.current ??= crypto.randomUUID();
    try {
      const result = await postArticleComment(slug, requestId.current, body);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSaved(result.state);
      setBody("");
      requestId.current = null;
      setPage(1);
      setRefresh((value) => value + 1);
    } catch {
      setError("commentRequestFailed");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="panel draft-card" aria-label={t("articleComments")}>
      <h2>{t("articleComments")}</h2>
      <p>{t("articleCommentsHelp")}</p>
      {signedIn && !denied ? (
        <form onSubmit={submit}>
          <label className="draft-title">
            {t("commentBody")}
            <textarea
              name="comment"
              rows={4}
              required
              maxLength={2000}
              value={body}
              disabled={pending}
              onChange={(event) => {
                setBody(event.target.value);
                requestId.current = null;
                setSaved(null);
              }}
            />
          </label>
          <button className="button" disabled={pending || !body.trim()}>
            {t(pending ? "processing" : "submitComment")}
          </button>
        </form>
      ) : signedIn ? (
        <p>{denied && notice({ system: denied })}</p>
      ) : (
        <LocaleLink href="/login">{t("commentLogin")}</LocaleLink>
      )}
      {saved && (
        <p role="status">{t(saved === "PUBLISHED" ? "commentPublished" : "commentPending")}</p>
      )}
      {error && <p role="alert">{notice({ system: error })}</p>}
      {loading && <p role="status">{t("commentsLoading")}</p>}
      {loadFailed && (
        <div role="alert">
          <p>{notice({ system: "commentRequestFailed" })}</p>
          <button className="button secondary" onClick={() => setRefresh((value) => value + 1)}>
            {t("commentsRetry")}
          </button>
        </div>
      )}
      {data && (
        <>
          {!data.comments.length && <p>{t("commentsEmpty")}</p>}
          <div className="draft-list">
            {data.comments.map((comment) => (
              <article key={comment.id} className="panel draft-card">
                <p>
                  <strong>{comment.author.name}</strong> ·{" "}
                  <time dateTime={comment.createdAt}>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Taipei",
                    }).format(new Date(comment.createdAt))}{" "}
                    {t("timeZoneLabel")}
                  </time>
                </p>
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{comment.body}</p>
              </article>
            ))}
          </div>
          <nav className="draft-actions" aria-label={t("pagination")}>
            {page > 1 && (
              <button className="button secondary" onClick={() => setPage((value) => value - 1)}>
                {t("previousPage")}
              </button>
            )}
            <span>{t("pageNumber", { page })}</span>
            {data.more && (
              <button className="button secondary" onClick={() => setPage((value) => value + 1)}>
                {t("nextPage")}
              </button>
            )}
          </nav>
        </>
      )}
    </section>
  );
}
