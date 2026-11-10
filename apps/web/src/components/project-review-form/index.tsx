"use client";

import { useActionState, useState } from "react";
import { reviewProjectAction } from "@/app/[lang]/projects/actions";
import { useI18n } from "@/i18n/client";

export function ProjectReviewForm({ id, version }: { id: string; version: number }) {
  const { locale, t, notice } = useI18n();
  const [error, action, pending] = useActionState(
    reviewProjectAction.bind(null, locale, id, version),
    null,
  );
  const [reason, setReason] = useState("");
  return (
    <form action={action}>
      <label className="draft-title">
        {t("reviewNotes")}
        <textarea
          name="reason"
          rows={3}
          maxLength={2000}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <div className="draft-actions">
        <button className="button" type="submit" name="decision" value="approve" disabled={pending}>
          {t("approveAndPublish")}
        </button>
        <button
          className="button secondary"
          type="submit"
          name="decision"
          value="reject"
          disabled={pending}
        >
          {t("rejectSubmission")}
        </button>
      </div>
      {pending && <p role="status">{t("processing")}</p>}
      {error && (
        <p className="notice" role="alert">
          {notice({ system: error })}
        </p>
      )}
    </form>
  );
}
