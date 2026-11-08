"use client";
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <div>
      <button
        className="button secondary"
        type="button"
        disabled={!id || disabled || pending}
        onClick={() => {
          if (
            !id ||
            !window.confirm(
              owner
                ? "发布后所有访客都能阅读这篇文章，确定发布吗？"
                : "确定提交当前已保存的版本吗？提交后等待人工审核，暂不能直接修改。",
            )
          )
            return;
          setError("");
          onBusyChange(true);
          startTransition(async () => {
            try {
              const result = await submitArticleAction(id, version);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              router.replace(
                result.state === "PUBLISHED"
                  ? `/articles/${result.slug}`
                  : `/my-articles/${result.id}`,
              );
            } catch {
              setError("网络异常，请到我的文章确认状态后再操作。");
            } finally {
              onBusyChange(false);
            }
          });
        }}
      >
        {pending ? "正在提交…" : owner ? "直接发布" : "提交人工审核"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export function ReviewArticleForm({ id, version }: { id: string; version: number }) {
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  function review(decision: "approve" | "reject") {
    if (decision === "reject" && !reason.trim()) {
      setError("请填写拒绝原因。");
      return;
    }
    if (
      !window.confirm(
        decision === "approve" ? "通过后文章立即公开，确认通过审核吗？" : "确认拒绝这次投稿吗？",
      )
    )
      return;
    setError("");
    startTransition(async () => {
      try {
        const result = await reviewArticleAction(id, version, decision, reason);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.replace("/admin/reviews");
        router.refresh();
      } catch {
        setError("网络异常，请刷新确认审核结果。");
      }
    });
  }
  return (
    <section className="panel draft-card">
      <h2>审核决定</h2>
      <label className="draft-title">
        审核说明（拒绝时必填）
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
          通过并发布
        </button>
        <button className="button secondary" disabled={pending} onClick={() => review("reject")}>
          拒绝投稿
        </button>
      </div>
      {pending && <p role="status">正在处理…</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
export function CopyRejectedButton({ id, version }: { id: string; version: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <div>
      <button
        className="button"
        disabled={pending}
        onClick={() => {
          setError("");
          startTransition(async () => {
            try {
              const result = await copyRejectedArticleAction(id, version);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              router.push(`/write?id=${result.id}`);
            } catch {
              setError("网络异常，请查看草稿列表确认结果。");
            }
          });
        }}
      >
        {pending ? "正在复制…" : "复制为新草稿修改"}
      </button>
      {error && <p role="alert">{error}</p>}
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <div>
      <button
        type="button"
        className="button secondary"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              `确定删除已发布文章“${title}”吗？删除后不再公开，也不会显示在我的文章中；审核记录保留，暂不提供恢复入口。`,
            )
          )
            return;
          setError("");
          startTransition(async () => {
            try {
              const result = await deletePublishedArticleAction(id, version);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              router.refresh();
            } catch {
              setError("网络异常，请刷新列表确认删除结果。");
            }
          });
        }}
      >
        {pending ? "正在删除…" : "删除文章"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
