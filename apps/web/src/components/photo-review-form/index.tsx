"use client";
import { useActionState } from "react";
import { reviewPhotoAction } from "@/app/[lang]/photos/actions";
import { useI18n } from "@/i18n/client";
export function PhotoReviewForm({ id, version }: { id: string; version: number }) {
  const { t, notice } = useI18n();
  const [error, action, pending] = useActionState(reviewPhotoAction.bind(null, id, version), null);
  return (
    <form action={action}>
      <label className="draft-title">
        {t("reviewNotes")}
        <textarea name="reason" rows={2} maxLength={2000} />
      </label>
      <div className="draft-actions">
        <button className="button" name="decision" value="approve" disabled={pending}>
          {t("approveAndPublish")}
        </button>
        <button className="button secondary" name="decision" value="reject" disabled={pending}>
          {t("rejectSubmission")}
        </button>
      </div>
      {error && <p role="alert">{notice({ system: error })}</p>}
    </form>
  );
}
