import type { ComponentProps } from "react";
import ReactMarkdown, { type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import { documents } from "@/docs/catalog";
import { LocaleLink } from "@/i18n/link";

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
type TextNode = { value?: string; children?: TextNode[] };

function headingText(node: TextNode): string {
  return node.value ?? node.children?.map(headingText).join("") ?? "";
}

export function DocMarkdown({ markdown }: { markdown: string }) {
  const ids = new Set<string>();
  function heading(Tag: HeadingTag) {
    return function DocHeading({ node, children }: ComponentProps<HeadingTag> & ExtraProps) {
      const base = headingText(node ?? {})
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, "")
        .replace(/\s/g, "-");
      let id = base;
      for (let suffix = 1; ids.has(id); suffix++) id = `${base}-${suffix}`;
      ids.add(id);
      return <Tag id={id || undefined}>{children}</Tag>;
    };
  }

  return (
    <article className="panel prose docs-content" lang="zh">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          h1: heading("h1"),
          h2: heading("h2"),
          h3: heading("h3"),
          h4: heading("h4"),
          h5: heading("h5"),
          h6: heading("h6"),
          a: ({ href, children }) => {
            const relative = /^(?:\.\/)?([^/#?]+\.md)([?#].*)?$/.exec(href ?? "");
            if (relative) {
              const target = documents.find((document) => document.file === relative[1]);
              return target ? (
                <LocaleLink href={`/docs/${target.slug}${relative[2] ?? ""}`}>
                  {children}
                </LocaleLink>
              ) : (
                <span>{children}</span>
              );
            }
            return !href || href.startsWith(".") ? (
              <span>{children}</span>
            ) : (
              <a href={href}>{children}</a>
            );
          },
          table: ({ children }) => (
            <div className="docs-table">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
