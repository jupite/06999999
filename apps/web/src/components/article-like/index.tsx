"use client";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { articleLike, type ArticleLikeState } from "@/api";
import { useI18n } from "@/i18n/client";
import { LocaleLink } from "@/i18n/link";
import type { SystemKey } from "@/i18n/messages";
export function ArticleLike({ slug }: { slug: string }) {
  const { t, notice } = useI18n();
  const [state, setState] = useState<ArticleLikeState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<SystemKey | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setState(null);
    setError(null);
    articleLike(slug, "GET", controller.signal)
      .then((result) => {
        if ("error" in result) setError(result.error);
        else setState(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("likeRequestFailed");
      });
    return () => controller.abort();
  }, [slug]);
  async function toggle() {
    if (!state || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await articleLike(slug, state.liked ? "DELETE" : "PUT");
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
