"use client";
import { useActionState, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { WithdrawableKind, WithdrawableState } from "@/server/services/withdrawal";
import { withdrawSubmissionAction } from "./actions";
export function ContentWithdrawal({
  id,
  version,
  kind,
  state,
  title,
}: {
  id: string;
  version: number;
  kind: WithdrawableKind;
  state: WithdrawableState;
  title: string;
}) {
  const { t, notice } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [error, action, pending] = useActionState(
    withdrawSubmissionAction.bind(null, id, version, kind, state),
    null,
  );
  if (!confirming)
    return (
      <button type="button" className="button secondary" onClick={() => setConfirming(true)}>
        {t(state === "PUBLISHED" ? "unpublishSubmission" : "withdrawSubmission")}
      </button>
    );
  return (
    <form action={action} className="panel draft-card" aria-label={t("withdrawalConfirmTitle")}>
      <input type="hidden" name="confirm" value="yes" />
      <p>{t("withdrawalConfirm", { title })}</p>
      <div className="draft-actions">
        <button className="button" disabled={pending}>
          {t(pending ? "processing" : "withdrawalConfirmButton")}
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          {t("withdrawalCancel")}
        </button>
      </div>
      {error && <p role="alert">{notice({ system: error })}</p>}
    </form>
  );
}
