import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "../domain/permissions";
import { DraftError, parseDraft, requireDraftActor } from "../domain/drafts";
import { articleMedia } from "./article-media";
import { articleTaxonomy, resolveArticleTaxonomy } from "./article-taxonomy";

type Db = Prisma.TransactionClient;
function scope(actor: Actor): Prisma.ContentWhereInput {
  return {
    authorId: actor.id,
    kind: "POST",
    publishedVersion: null,
    revisions: { some: { state: "DRAFT" }, every: { state: "DRAFT" } },
  };
}
export async function listDrafts(db: Db, actor: Actor) {
  if (actor.banned) throw new DraftError("accountBanned");
  return db.content.findMany({
    where: scope(actor),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 100,
    select: {
      id: true,
      currentVersion: true,
      updatedAt: true,
      revisions: { orderBy: { version: "desc" }, take: 1, select: { title: true } },
    },
  });
}
export async function readDraft(db: Db, actor: Actor, id: string) {
  if (actor.banned) throw new DraftError("accountBanned");
  const content = await db.content.findFirst({
    where: { ...scope(actor), id },
    include: { revisions: { orderBy: { version: "desc" }, take: 1, include: articleTaxonomy } },
  });
  if (!content) return null;
  const revision = content.revisions[0];
  return {
    id: content.id,
    version: content.currentVersion,
    title: revision.title,
    markdown: revision.markdown,
    categoryId: revision.categoryId,
    tagText: revision.tags.map((tag) => tag.name).join(", "),
  };
}
// Call inside a transaction so the version increment and revision are atomic.
export async function saveDraft(db: Db, actor: Actor | null, value: unknown) {
  const input = parseDraft(value);
  const author = requireDraftActor(actor, !!input.id);
  const media = await articleMedia(db, author.id, input.markdown);
  if (!input.id) {
    const { fields, relations } = await resolveArticleTaxonomy(db, input);
    const content = await db.content.create({
      data: {
        authorId: author.id,
        kind: "POST",
        slug: randomUUID(),
        revisions: {
          create: { version: 1, title: input.title, markdown: input.markdown, media, ...relations },
        },
      },
    });
    return { ...input, ...fields, id: content.id, version: 1 };
  }
  const updated = await db.content.updateMany({
    where: { ...scope(author), id: input.id, currentVersion: input.version },
    data: { currentVersion: { increment: 1 }, updatedAt: new Date() },
  });
  if (updated.count !== 1) throw new DraftError("draftEditConflict");
  const { fields, relations } = await resolveArticleTaxonomy(db, input, {
    id: input.id,
    version: input.version,
  });
  await db.contentRevision.create({
    data: {
      contentId: input.id,
      version: input.version + 1,
      title: input.title,
      markdown: input.markdown,
      media,
      ...relations,
    },
  });
  return { ...input, ...fields, id: input.id, version: input.version + 1 };
}
export async function deleteDraft(db: Db, actor: Actor | null, id: unknown, version: unknown) {
  const author = requireDraftActor(actor, true);
  if (
    typeof id !== "string" ||
    !id ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 1
  )
    throw new DraftError("invalidDraftReference");
  const result = await db.content.deleteMany({
    where: { ...scope(author), id, currentVersion: version },
  });
  if (result.count !== 1) throw new DraftError("draftDeleteConflict");
}
