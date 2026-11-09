import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { splitTagNames, taxonomyName } from "../domain/article-taxonomy";
import { DraftError, type DraftInput } from "../domain/drafts";
import { authorize, type Actor } from "../domain/permissions";

export const articleTaxonomy = {
  category: { select: { id: true, name: true } },
  tags: { orderBy: { name: "asc" }, select: { id: true, name: true } },
} satisfies Prisma.ContentRevisionInclude;

export function listArticleCategories(db: Prisma.TransactionClient) {
  return db.category.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }] });
}

export async function createArticleCategory(
  db: Prisma.TransactionClient,
  actor: Actor | null,
  value: unknown,
) {
  const access = authorize(actor, "site.manage");
  if (!actor || !access.allowed) throw new DraftError(access.reason);
  const name = taxonomyName(value);
  if (!name) throw new DraftError("invalidCategoryName");
  const [category] = await db.category.createManyAndReturn({
    data: { name },
    skipDuplicates: true,
  });
  if (!category) throw new DraftError("categoryNameTaken");
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: "article.createCategory",
      targetId: category.id,
      after: { name },
    },
  });
  return category;
}

// Omitted fields keep the previous version's associations for existing callers.
export async function resolveArticleTaxonomy(
  db: Prisma.TransactionClient,
  input: DraftInput,
  previous?: { id: string; version: number },
) {
  const prior =
    previous && (input.categoryId === undefined || input.tagText === undefined)
      ? await db.contentRevision.findUniqueOrThrow({
          where: { contentId_version: { contentId: previous.id, version: previous.version } },
          include: articleTaxonomy,
        })
      : null;
  const categoryId =
    input.categoryId === undefined ? (prior?.categoryId ?? null) : input.categoryId;
  if (
    categoryId &&
    !(await db.category.findUnique({ where: { id: categoryId }, select: { id: true } }))
  ) {
    throw new DraftError("articleCategoryMissing");
  }

  let tags = prior?.tags ?? [];
  if (input.tagText !== undefined) {
    const names = splitTagNames(input.tagText).sort();
    tags = [];
    if (names.length) {
      await db.tag.createMany({ data: names.map((name) => ({ name })), skipDuplicates: true });
      tags = await db.tag.findMany({ where: { name: { in: names } }, orderBy: { name: "asc" } });
    }
  }
  return {
    fields: { categoryId, tagText: tags.map((tag) => tag.name).join(", ") },
    relations: { categoryId, tags: { connect: tags.map(({ id }) => ({ id })) } },
  };
}
