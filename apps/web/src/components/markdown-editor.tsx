"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { saveDraftAction } from "@/app/write/actions";
import { SubmitArticleButton } from "./article-controls";

type Draft = { id?: string; version: number; title: string; markdown: string };
export function MarkdownEditor({
  initialDraft,
  owner,
  canSubmit,
}: {
  initialDraft: Draft;
  owner: boolean;
  canSubmit: boolean;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [dirty, setDirty] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function edit(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
    setMessage("");
    setError("");
  }
  return (
    <>
      <div className="editor-toolbar">
        <Link
          href="/my-articles?status=draft"
          onClick={(event) => {
            if (dirty && !window.confirm("有未保存的修改，仍要离开吗？")) event.preventDefault();
          }}
        >
          ← 返回草稿列表
        </Link>
        <span>{dirty ? "有未保存的修改" : draft.id ? "已保存至数据库" : "新草稿"}</span>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          setMessage("");
          startTransition(async () => {
            try {
              const result = await saveDraftAction(draft);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setDraft(result.draft);
              setDirty(false);
              setMessage("已保存至数据库，可在我的文章的草稿筛选中重新打开。");
              if (!draft.id)
                router.replace(`/write?id=${encodeURIComponent(result.draft.id)}`, {
                  scroll: false,
                });
            } catch {
              setError("网络异常，保存未确认。请保留正文后重试。");
            }
          });
        }}
      >
        <label className="draft-title">
          文章标题
          <input
            required
            maxLength={160}
            value={draft.title}
            disabled={pending || publishing}
            placeholder="给这篇文章起个标题"
            onChange={(e) => edit({ title: e.target.value })}
          />
        </label>
        <div className="editor-grid">
          <label className="panel editor-input">
            <span className="eyebrow">MARKDOWN</span>
            <textarea
              aria-label="Markdown 正文"
              maxLength={100000}
              disabled={pending || publishing}
              value={draft.markdown}
              onChange={(e) => edit({ markdown: e.target.value })}
            />
          </label>
          <section className="panel editor-preview">
            <span className="eyebrow">预览</span>
            <div className="prose">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                skipHtml
                components={{
                  img: () => <span className="notice">图片预览待接入授权媒体服务</span>,
                }}
              >
                {draft.markdown}
              </ReactMarkdown>
            </div>
          </section>
        </div>
        <div className="editor-toolbar">
          <button className="button" disabled={pending || publishing} type="submit">
            {pending ? "正在保存…" : "保存草稿"}
          </button>
          <SubmitArticleButton
            id={draft.id}
            version={draft.version}
            owner={owner}
            disabled={dirty || pending || publishing || !canSubmit}
            onBusyChange={setPublishing}
          />
          {!draft.id && (
            <button
              className="button secondary"
              type="button"
              disabled={pending || publishing}
              onClick={() => {
                if (dirty && !window.confirm("导入旧的本地草稿会替换当前正文，是否继续？")) return;
                try {
                  const old = localStorage.getItem("site:editor-demo");
                  if (old) {
                    edit({ markdown: old });
                    setMessage("旧草稿已导入，填写标题并保存后才会写入数据库。");
                  } else setMessage("此浏览器没有旧的本地草稿。");
                } catch {
                  setError("无法读取本地草稿。");
                }
              }}
            >
              导入旧的本地草稿
            </button>
          )}
        </div>
      </form>
      {message && <p role="status">{message}</p>}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <p className="muted">
        请先保存最新修改，再发布或投稿。站主直接发布，其他用户等待人工审核。投稿后暂不能直接编辑；图片上传尚未开放。
      </p>
    </>
  );
}
