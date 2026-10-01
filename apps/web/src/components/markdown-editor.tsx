"use client";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
const initial = "# 写下此刻的想法\n\n这里是 **Markdown 编辑预览**。\n\n- 写一篇文章\n- 留住一段日常\n\n> 时间会流逝，文字会留下。";
export function MarkdownEditor() {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  useEffect(() => { try { const draft = localStorage.getItem("site:editor-demo"); if (draft) setValue(draft); } catch {} }, []);
  return <><div className="editor-toolbar"><span>本地写作预览 · 不会公开发布</span><button className="button secondary" onClick={() => { try { localStorage.setItem("site:editor-demo", value); setSaved(true); } catch { setSaved(false); } }}>{saved ? "已保存到此浏览器" : "保存本地草稿"}</button></div><div className="editor-grid"><label className="panel editor-input"><span className="eyebrow">MARKDOWN</span><textarea aria-label="Markdown 正文" value={value} onChange={e => { setValue(e.target.value); setSaved(false); }}/></label><section className="panel editor-preview"><span className="eyebrow">预览</span><div className="prose"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{ img: () => <span className="notice">图片预览待接入授权媒体服务</span> }}>{value}</ReactMarkdown></div></section></div><p className="muted">这里只保存于当前浏览器。正式草稿、图片上传和提交审核将在内容服务接通后开放。</p></>;
}
