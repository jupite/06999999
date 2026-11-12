import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { SystemKey } from "@/i18n/messages";
import { accountActor, authorize, type Actor } from "../domain/permissions";
import { lockUserAccount } from "./user-access";

export class LikeError extends Error {
  constructor(
    readonly key: SystemKey,
    readonly status: number,
  ) {
    super(key);
  }
}
type Db = Prisma.TransactionClient;
async function publication(db: Db, slug: string, lock = false) {
  const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT c.id FROM "Content" c JOIN "ContentRevision" r ON r."contentId"=c.id
      AND r.version=c."publishedVersion" AND r.state='PUBLISHED'
    WHERE c.slug=${slug} AND c.kind='POST'
    ${lock ? Prisma.sql`FOR SHARE OF c` : Prisma.empty}
  `);
  if (!rows[0]) throw new LikeError("likeArticleMissing", 404);
  return rows[0].id;
}
async function state(db: Db, contentId: string, userId?: string) {
  const [result] = await db.$queryRaw<{ count: bigint; liked: boolean }[]>`
    SELECT (SELECT count(*) FROM "Like" WHERE "contentId"=${contentId}) AS count,
      EXISTS(SELECT 1 FROM "Like" WHERE "contentId"=${contentId} AND "userId"=${userId ?? ""}) AS liked
  `;
  return { count: Number(result.count), liked: result.liked };
}
export async function readArticleLike(db: Db, actor: Actor | null, slug: string) {
  return state(db, await publication(db, slug), actor?.id);
}
export async function setArticleLike(
  db: PrismaClient,
  actor: Actor | null,
  slug: string,
  liked: boolean,
) {
  if (!actor) throw new LikeError("loginRequired", 401);
  return db.$transaction(async (tx) => {
    await lockUserAccount(tx, actor.id);
    const user = await tx.user.findUnique({
      where: { id: actor.id },
      include: { permissions: true },
    });
    if (!user) throw new LikeError("loginRequired", 401);
    const access = authorize(accountActor(user, process.env.OWNER_GITHUB_ID), "like.toggle");
    if (!access.allowed) throw new LikeError(access.reason, 403);
    const contentId = await publication(tx, slug, true);
    if (liked)
      await tx.like.createMany({ data: [{ userId: actor.id, contentId }], skipDuplicates: true });
    else await tx.like.deleteMany({ where: { userId: actor.id, contentId } });
    return state(tx, contentId, actor.id);
  });
}
