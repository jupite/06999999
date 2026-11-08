import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
export function ArticleBody({ markdown }: { markdown: string }) {
  return (
    <div className="prose article-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          img: () => <span className="notice">图片上传功能尚未开放</span>,
          a: ({ href, children }) => (
            <a href={href} rel="nofollow ugc noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
