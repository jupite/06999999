import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { MusicTrack } from "@/music/source";

type Db = Prisma.TransactionClient;

export function listMusicLibrary(db: Db) {
  return db.musicLibraryTrack.findMany({
    orderBy: { position: "asc" },
    select: { id: true, title: true, artist: true, coverUrl: true },
  });
}

export async function addLibraryTracks(tx: Db, actorId: string, tracks: MusicTrack[]) {
  const added = await tx.musicLibraryTrack.createManyAndReturn({
    data: tracks,
    skipDuplicates: true,
    select: { id: true },
  });
  if (added.length)
    await tx.auditLog.create({
      data: {
        actorId,
        action: "music.import",
        targetId: "music-library",
        after: { ids: added.map((track) => track.id) },
      },
    });
  return added.length;
}

export async function removeLibraryTrack(tx: Db, actorId: string, id: string) {
  const result = await tx.musicLibraryTrack.deleteMany({ where: { id } });
  if (result.count)
    await tx.auditLog.create({
      data: { actorId, action: "music.remove", targetId: "music-library", before: { id } },
    });
}
