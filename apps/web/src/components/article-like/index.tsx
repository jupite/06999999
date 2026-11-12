"use client";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { articleLike, type ArticleLikeState } from "@/api";
import { useI18n } from "@/i18n/client";
import { LocaleLink } from "@/i18n/link";
import type { SystemKey } from "@/i18n/messages";
export function ArticleLike({
  slug,
  content = "articles",
  initialState,
}: {
  slug: string;
  content?: "articles" | "projects";
  initialState?: ArticleLikeState;
}) {
  const { t, notice } = useI18n();
  const [state, setState] = useState<ArticleLikeState | null>(initialState ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<SystemKey | null>(null);
  useEffect(() => {
    if (initialState) {
      setState(initialState);
      setError(null);
      return;
    }
    const controller = new AbortController();
    setState(null);
    setError(null);
    articleLike(slug, "GET", controller.signal, content)
      .then((result) => {
        if ("error" in result) setError(result.error);
        else setState(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("likeRequestFailed");
      });
    return () => controller.abort();
  }, [slug, content, initialState]);
  async function toggle() {
    if (!state || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await articleLike(slug, state.liked ? "DELETE" : "PUT", undefined, content);
      if ("error" in result) setError(result.error);
      else setState(result);
    } catch {
      setError("likeRequestFailed");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="draft-actions" aria-busy={pending}>
      <button
        className="button secondary"
        type="button"
        onClick={toggle}
        disabled={!state || pending}
        aria-pressed={state?.liked ?? false}
      >
        <Heart size={16} fill={state?.liked ? "currentColor" : "none"} />
        {t(state?.liked ? "articleUnlike" : "articleLike")}
        {state && ` · ${state.count}`}
      </button>
      <span role="status" aria-live="polite">
        {error
          ? notice({ system: error })
          : state
            ? t("articleLikeCount", { count: state.count })
            : t("articleLikeLoading")}
      </span>
      {error === "loginRequired" && <LocaleLink href="/login">{t("goLogin")}</LocaleLink>}
    </div>
  );
}
