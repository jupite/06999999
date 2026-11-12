import { resolveAccountActor } from "../access";
import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { SystemKey } from "@/i18n/messages";
import { authorize, type Actor } from "../domain/permissions";
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
export type LikeKind = "POST" | "PROJECT";
export const likeMissingKey = (kind: LikeKind) =>
  kind === "POST" ? "likeArticleMissing" : "likeProjectMissing";
async function publication(db: Db, reference: string, lock = false, kind: LikeKind = "POST") {
  const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT c.id FROM "Content" c JOIN "ContentRevision" r ON r."contentId"=c.id
      AND r.version=c."publishedVersion" AND r.state='PUBLISHED'
    WHERE ${kind === "POST" ? Prisma.sql`c.slug=${reference}` : Prisma.sql`c.id=${reference}`} AND c.kind=${kind}::"ContentKind"
    ${lock ? Prisma.sql`FOR SHARE OF c` : Prisma.empty}
  `);
  if (!rows[0]) throw new LikeError(likeMissingKey(kind), 404);
  return rows[0].id;
}
async function state(db: Db, contentId: string, userId?: string) {
  const [result] = await db.$queryRaw<{ count: bigint; liked: boolean }[]>`
    SELECT (SELECT count(*) FROM "Like" WHERE "contentId"=${contentId}) AS count,
      EXISTS(SELECT 1 FROM "Like" WHERE "contentId"=${contentId} AND "userId"=${userId ?? ""}) AS liked
  `;
  return { count: Number(result.count), liked: result.liked };
}
export async function readContentLike(
  db: Db,
  actor: Actor | null,
  reference: string,
  kind: LikeKind = "POST",
) {
  return state(db, await publication(db, reference, false, kind), actor?.id);
}
export async function setContentLike(
  db: PrismaClient,
  actor: Actor | null,
  reference: string,
  liked: boolean,
  kind: LikeKind = "POST",
) {
  if (!actor) throw new LikeError("loginRequired", 401);
  return db.$transaction(async (tx) => {
    await lockUserAccount(tx, actor.id);
    const user = await tx.user.findUnique({
      where: { id: actor.id },
      include: { permissions: true },
    });
    if (!user) throw new LikeError("loginRequired", 401);
    const access = authorize(
      await resolveAccountActor(tx, user, process.env.OWNER_GITHUB_ID),
      "like.toggle",
    );
    if (!access.allowed) throw new LikeError(access.reason, 403);
    const contentId = await publication(tx, reference, true, kind);
    if (liked)
      await tx.like.createMany({ data: [{ userId: actor.id, contentId }], skipDuplicates: true });
    else await tx.like.deleteMany({ where: { userId: actor.id, contentId } });
    return state(tx, contentId, actor.id);
  });
}

export { readContentLike as readArticleLike, setContentLike as setArticleLike };
export async function readProjectLikes(db: Db, actor: Actor | null, ids: string[]) {
  if (!ids.length) return new Map<string, { count: number; liked: boolean }>();
  const rows = await db.$queryRaw<{ id: string; count: bigint; liked: boolean }[]>(Prisma.sql`
    SELECT c.id, (SELECT count(*) FROM "Like" l WHERE l."contentId"=c.id) AS count,
      EXISTS(SELECT 1 FROM "Like" l WHERE l."contentId"=c.id AND l."userId"=${actor?.id ?? ""}) AS liked
    FROM "Content" c JOIN "ContentRevision" r ON r."contentId"=c.id
      AND r.version=c."publishedVersion" AND r.state='PUBLISHED'
    WHERE c.id IN (${Prisma.join(ids)}) AND c.kind='PROJECT'
  `);
  return new Map(rows.map((row) => [row.id, { count: Number(row.count), liked: row.liked }]));
}
