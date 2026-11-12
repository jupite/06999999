import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { authorize, type Actor } from "../domain/permissions";
import { listPendingArticles } from "./articles";
import { listPendingPhotos } from "./photos";
import { listPendingProjects } from "./projects";

export async function getAdminOverview(db: PrismaClient, actor: Actor | null) {
  const access = authorize(actor, "site.manage");
  if (!access.allowed) throw new Error(access.reason);

  return db.$transaction(
    async (tx) => {
      const articles = await listPendingArticles(tx, actor);
      const projects = await listPendingProjects(tx, actor, 1);
      const photos = await listPendingPhotos(tx, actor);
      const pendingPhotos = await tx.content.count({
        where: { kind: "PHOTO", revisions: { some: { state: "PENDING_HUMAN" } } },
      });
      const pendingArticles = await tx.content.count({
        where: { kind: "POST", revisions: { some: { state: "PENDING_HUMAN" } } },
      });
      const pendingProjects = await tx.content.count({
        where: { kind: "PROJECT", revisions: { some: { state: "PENDING_HUMAN" } } },
      });
      const [published] = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM "Content" c
      JOIN "ContentRevision" r ON r."contentId" = c.id
        AND r.version = c."publishedVersion" AND r.state = 'PUBLISHED'
      WHERE c.kind IN ('POST', 'PROJECT', 'PHOTO')
    `;
      const pendingComments = await tx.comment.count({
        where: { state: "PENDING_HUMAN", content: { kind: "POST" } },
      });
      const users = await tx.user.count();
      const media = await tx.media.aggregate({ _sum: { bytes: true } });
      const settings = await tx.siteSettings.findUnique({
        where: { id: "site" },
        select: { totalMediaLimitBytes: true },
      });
      const pending = [...articles, ...projects, ...photos]
        .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime() || a.id.localeCompare(b.id))
        .slice(0, 6)
        .map((content) => ({
          id: content.id,
          title: content.revisions[0]?.title ?? "",
          author: content.author.name,
          kind: content.kind,
        }));
      return {
        pendingArticles,
        pendingProjects,
        pendingPhotos,
        pendingComments,
        published: Number(published.count),
        users,
        pending,
        usedBytes: media._sum.bytes ?? 0n,
        limitBytes: settings?.totalMediaLimitBytes ?? 0n,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
