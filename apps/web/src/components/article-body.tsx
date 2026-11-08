import { getI18n } from "@/i18n/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
export async function ArticleBody({ markdown }: { markdown: string }) {
  const { t } = await getI18n();
  return (
    <div className="prose article-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          img: () => <span className="notice">{t("imagesUnavailable")}</span>,
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
