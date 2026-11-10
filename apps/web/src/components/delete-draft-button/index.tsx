"use client";

import { useI18n, type Notice } from "@/i18n/client";
import { useState, useTransition } from "react";
import { deleteDraftAction } from "@/app/[lang]/write/actions";
export function DeleteDraftButton({
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
  return (
    <div>
      <button
        className="button secondary"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(t("confirmDeleteDraft", { title }))) return;
          setError(null);
          startTransition(async () => {
            try {
              const result = await deleteDraftAction(id, version);
              if (!result.ok) setError({ system: result.error });
            } catch {
              setError("deleteDraftNetworkError");
            }
          });
        }}
      >
        {pending ? t("deleting") : t("deleteDraft")}
      </button>
      {error && <p role="alert">{notice(error)}</p>}
    </div>
  );
}
