import "server-only";
import { Prisma } from "@/generated/prisma/client";

type Db = Prisma.TransactionClient;
type Term = { id: string; name: string };
type PublicArticle = {
  slug: string;
  title: string;
  markdown: string;
  authorName: string;
  publishedAt: Date;
  category: Term | null;
  tags: Term[];
};

// Match the exact publication pointer before filtering or paginating.
const currentPublication = Prisma.sql`
  FROM "Content" c
  JOIN "ContentRevision" r ON r."contentId" = c.id
    AND r.version = c."publishedVersion"
    AND r.state = 'PUBLISHED'
    AND c.kind = 'POST'
`;

const publicArticles = Prisma.sql`
  SELECT c.slug, r.title, r.markdown, u.name AS "authorName",
    COALESCE(
      (SELECT MAX(m."createdAt") FROM "ModerationReview" m
       WHERE m."revisionId" = r.id AND m.result = 'PUBLISHED'),
      c."updatedAt"
    ) AS "publishedAt",
    CASE WHEN cat.id IS NOT NULL
      THEN jsonb_build_object('id', cat.id, 'name', cat.name) END AS category,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', tag.id, 'name', tag.name) ORDER BY tag.name)
       FROM "_ContentRevisionToTag" rt JOIN "Tag" tag ON tag.id = rt."B"
       WHERE rt."A" = r.id),
      '[]'::jsonb
    ) AS tags
  ${currentPublication}
  JOIN "User" u ON u.id = c."authorId"
  LEFT JOIN "Category" cat ON cat.id = r."categoryId"
`;

export function listPublishedArticles(
  db: Db,
  page = 1,
  { categoryId, tagId }: { categoryId?: string; tagId?: string } = {},
) {
  return db.$queryRaw<PublicArticle[]>`
    ${publicArticles}
    WHERE (${categoryId ?? null}::text IS NULL OR r."categoryId" = ${categoryId ?? null})
      AND (${tagId ?? null}::text IS NULL OR EXISTS (
        SELECT 1 FROM "_ContentRevisionToTag" rt
        WHERE rt."A" = r.id AND rt."B" = ${tagId ?? null}
      ))
    ORDER BY c."updatedAt" DESC, c.id DESC
    LIMIT 21 OFFSET ${(page - 1) * 20}
  `;
}

export async function readPublishedArticle(db: Db, slug: string) {
  const [article] = await db.$queryRaw<PublicArticle[]>`${publicArticles} WHERE c.slug = ${slug}`;
  return article ?? null;
}

export async function listPublishedTerms(db: Db) {
  const terms = await db.$queryRaw<(Term & { kind: "category" | "tag" })[]>`
    WITH published AS (
      SELECT r.id, r."categoryId" ${currentPublication}
    )
    SELECT DISTINCT 'category' AS kind, cat.id, cat.name
    FROM published p JOIN "Category" cat ON cat.id = p."categoryId"
    UNION ALL
    SELECT DISTINCT 'tag' AS kind, tag.id, tag.name
    FROM published p JOIN "_ContentRevisionToTag" rt ON rt."A" = p.id
    JOIN "Tag" tag ON tag.id = rt."B"
    ORDER BY name, id
  `;
  return {
    categories: terms.filter(({ kind }) => kind === "category"),
    tags: terms.filter(({ kind }) => kind === "tag"),
  };
}
