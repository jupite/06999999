"use client";

import { useI18n, type Notice } from "@/i18n/client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  submitArticleAction,
  deletePublishedArticleAction,
  reviewArticleAction,
  copyRejectedArticleAction,
} from "@/app/articles/actions";

export function SubmitArticleButton({
  id,
  version,
  owner,
  disabled,
  onBusyChange,
}: {
  id?: string;
  version: number;
  owner: boolean;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t, notice } = useI18n();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<Notice | null>(null);
  const router = useRouter();
  return (
    <div>
      <button
        className="button secondary"
        type="button"
        disabled={!id || disabled || pending}
        onClick={() => {
          if (!id || !window.confirm(owner ? t("confirmPublish") : t("confirmSubmit"))) return;
          setError(null);
          onBusyChange(true);
          startTransition(async () => {
            try {
              const result = await submitArticleAction(id, version);
              if (!result.ok) {
                setError({ system: result.error });
                return;
              }
              router.replace(
                result.state === "PUBLISHED"
                  ? `/articles/${result.slug}`
                  : `/my-articles/${result.id}`,
              );
            } catch {
              setError("submitNetworkError");
            } finally {
              onBusyChange(false);
            }
          });
        }}
      >
        {pending ? t("submitting") : owner ? t("publish") : t("submit")}
      </button>
      {error && <p role="alert">{notice(error)}</p>}
    </div>
  );
}
export function ReviewArticleForm({ id, version }: { id: string; version: number }) {
  const { t, notice } = useI18n();
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<Notice | null>(null);
  const router = useRouter();
  function review(decision: "approve" | "reject") {
    if (decision === "reject" && !reason.trim()) {
      setError("rejectionReasonRequired");
      return;
    }
    if (!window.confirm(decision === "approve" ? t("confirmApprove") : t("confirmReject"))) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await reviewArticleAction(id, version, decision, reason);
        if (!result.ok) {
          setError({ system: result.error });
          return;
        }
        router.replace("/admin/reviews");
        router.refresh();
      } catch {
        setError("reviewNetworkError");
      }
    });
  }
  return (
    <section className="panel draft-card">
      <h2>{t("reviewDecision")}</h2>
      <label className="draft-title">
        {t("reviewNotes")}
        <textarea
          value={reason}
          maxLength={2000}
          rows={4}
          disabled={pending}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <div className="draft-actions">
        <button className="button" disabled={pending} onClick={() => review("approve")}>
          {t("approveAndPublish")}
        </button>
        <button className="button secondary" disabled={pending} onClick={() => review("reject")}>
          {t("rejectSubmission")}
        </button>
      </div>
      {pending && <p role="status">{t("processing")}</p>}
      {error && <p role="alert">{notice(error)}</p>}
    </section>
  );
}
export function CopyRejectedButton({ id, version }: { id: string; version: number }) {
  const { t, notice } = useI18n();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<Notice | null>(null);
  const router = useRouter();
  return (
    <div>
      <button
        className="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const result = await copyRejectedArticleAction(id, version);
              if (!result.ok) {
                setError({ system: result.error });
                return;
              }
              router.push(`/write?id=${result.id}`);
            } catch {
              setError("copyNetworkError");
            }
          });
        }}
      >
        {pending ? t("copying") : t("copyRejected")}
      </button>
      {error && <p role="alert">{notice(error)}</p>}
    </div>
  );
}

export function DeletePublishedArticleButton({
  id,
  version,
  title,
}: {
  id: string;
  version: number;
  title: string;
}) {
  const { t, notice } = useI18n();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<Notice | null>(null);
  const router = useRouter();
  return (
    <div>
      <button
        type="button"
        className="button secondary"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(t("confirmDeleteArticle", { title }))) return;
          setError(null);
          startTransition(async () => {
            try {
              const result = await deletePublishedArticleAction(id, version);
              if (!result.ok) {
                setError({ system: result.error });
                return;
              }
              router.refresh();
            } catch {
              setError("deleteArticleNetworkError");
            }
          });
        }}
      >
        {pending ? t("deleting") : t("deleteArticle")}
      </button>
      {error && <p role="alert">{notice(error)}</p>}
    </div>
  );
}
