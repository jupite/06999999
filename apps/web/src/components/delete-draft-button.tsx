"use client";
import { useState, useTransition } from "react";
import { deleteDraftAction } from "@/app/write/actions";
export function DeleteDraftButton({
  id,
  version,
  title,
}: {
  id: string;
  version: number;
  title: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <div>
      <button
        className="button secondary"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`确定删除草稿“${title}”吗？删除后无法恢复。`)) return;
          setError("");
          startTransition(async () => {
            try {
              const result = await deleteDraftAction(id, version);
              if (!result.ok) setError(result.error);
            } catch {
              setError("网络异常，请刷新确认删除结果。");
            }
          });
        }}
      >
        {pending ? "正在删除…" : "删除草稿"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
