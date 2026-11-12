import { LocaleLink } from "@/i18n/link";

type Term = { id: string; name: string };

export function ArticleTopics({
  category,
  tags,
  publicLinks = false,
  base = "/articles",
}: {
  category: Term | null;
  tags: Term[];
  publicLinks?: boolean;
  base?: "/articles" | "/photos";
}) {
  const topics = [
    ...(category ? [{ kind: "category", ...category }] : []),
    ...tags.map((tag) => ({ kind: "tag", ...tag })),
  ];
  if (!topics.length) return null;
  return (
    <ul className="article-topics">
      {topics.map(({ id, kind, name }) => {
        const label = kind === "tag" ? `#${name}` : name;
        return (
          <li key={`${kind}:${id}`}>
            {publicLinks ? (
              <LocaleLink className="pill" href={`${base}?${kind}=${encodeURIComponent(id)}`}>
                {label}
              </LocaleLink>
            ) : (
              <span className="pill">{label}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
