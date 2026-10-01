import { MarkdownEditor } from "@/components/markdown-editor";
export const metadata = { title: "写作预览" };
export default function WritePage() { return <><div className="page-heading"><span className="eyebrow">A SPACE FOR YOUR THOUGHTS</span><h1>写下此刻<span className="brand-dot">.</span></h1><p>从一句话开始，不必急着完成。</p></div><MarkdownEditor/></>; }
