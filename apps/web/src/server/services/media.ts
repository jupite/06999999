import { loadFeatureFlags } from "../access";
import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, statfs, unlink } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import sharp from "sharp";
import type { PrismaClient } from "@/generated/prisma/client";
import { imageIdFromUrl, imageUrl } from "@/media/urls";
import { bytesPerMib, maxUploadMib, MediaError } from "../domain/media";
import { authorize, withinQuota, type Actor } from "../domain/permissions";
import { lockUserAccount } from "./user-access";

const maximumBodyBytes = BigInt(maxUploadMib) * bytesPerMib;
const diskReserveBytes = 64n * bytesPerMib;
const maxPixels = 24_000_000;

function mediaRoot() {
  const root = process.env.MEDIA_ROOT?.trim();
  if (!root || !isAbsolute(root)) return undefined;
  const fromPublic = relative(join(process.cwd(), "public"), root);
  if (fromPublic === ".." || fromPublic.startsWith(`..${sep}`) || isAbsolute(fromPublic))
    return root;
  return undefined;
}

function requireUpload(actor: Actor | null): Actor {
  const access = authorize(actor, "image.upload");
  if (!actor || !access.allowed) throw new MediaError(access.reason, actor ? 403 : 401);
  return actor;
}

async function readBody(body: ReadableStream<Uint8Array> | null, limit: number) {
  if (!body) throw new MediaError("invalidImage");
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > limit) {
        await reader.cancel().catch(() => {});
        throw new MediaError("imageTooLarge", 413);
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, length);
}

async function normalizeImage(source: Buffer) {
  const jpeg = source.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  const png = source.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp =
    source.toString("ascii", 0, 4) === "RIFF" && source.toString("ascii", 8, 12) === "WEBP";
  if (!jpeg && !png && !webp) throw new MediaError("invalidImage");

  try {
    const image = sharp(source, { limitInputPixels: maxPixels });
    return await image
      .autoOrient()
      .resize(2560, 2560, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new MediaError("invalidImage");
  }
}

type UploadSettings = { maxImageBytes: bigint; totalMediaLimitBytes: bigint };

function imageLimit(settings: UploadSettings | null) {
  if (!settings || settings.maxImageBytes <= 0n || settings.totalMediaLimitBytes <= 0n)
    throw new MediaError("mediaUnconfigured", 503);
  return settings.maxImageBytes < maximumBodyBytes ? settings.maxImageBytes : maximumBodyBytes;
}

export async function storeImage(
  db: PrismaClient,
  actor: Actor | null,
  body: ReadableStream<Uint8Array> | null,
) {
  const uploader = requireUpload(actor);
  const root = mediaRoot();
  if (!root) throw new MediaError("mediaUnconfigured", 503);
  const settings = await db.siteSettings.findUnique({ where: { id: "site" } });
  const source = await readBody(body, Number(imageLimit(settings)));
  const image = await normalizeImage(source);
  const bytes = BigInt(image.byteLength);
  const id = randomUUID();
  const storageKey = `${id}.webp`;
  const path = join(root, storageKey);
  let created = false;

  try {
    await db.$transaction(async (tx) => {
      // Serialize quota checks and writes against the site settings row.
      const [limits] = await tx.$queryRaw<UploadSettings[]>`
        SELECT "maxImageBytes", "totalMediaLimitBytes" FROM "SiteSettings"
        WHERE "id" = 'site' FOR UPDATE
      `;
      const limit = imageLimit(limits ?? null);
      if (BigInt(source.byteLength) > limit || bytes > limit)
        throw new MediaError("imageTooLarge", 413);

      await lockUserAccount(tx, uploader.id);
      const user = await tx.user.findUnique({
        where: { id: uploader.id },
        select: {
          banned: true,
          quota: true,
          permissions: { where: { capability: "image.upload" }, select: { effect: true } },
        },
      });
      requireUpload(
        user
          ? {
              ...uploader,
              features: await loadFeatureFlags(tx),
              banned: user.banned,
              overrides: { "image.upload": user.permissions[0]?.effect },
            }
          : null,
      );
      const quota = user?.quota;
      if (!quota || !withinQuota(quota.usedBytes, quota.reservedBytes, bytes, quota.limitBytes))
        throw new MediaError("userMediaQuotaExceeded", 409);

      const total = await tx.media.aggregate({ _sum: { bytes: true } });
      if (!withinQuota(total._sum.bytes ?? 0n, 0n, bytes, limits.totalMediaLimitBytes))
        throw new MediaError("siteMediaQuotaExceeded", 409);

      await mkdir(root, { recursive: true });
      const disk = await statfs(root, { bigint: true });
      if (disk.bavail * disk.bsize < diskReserveBytes + bytes)
        throw new MediaError("mediaDiskFull", 507);

      const file = await open(path, "wx", 0o600);
      created = true;
      try {
        await file.writeFile(image);
        await file.sync();
      } finally {
        await file.close();
      }
      await tx.media.create({
        data: { id, ownerId: uploader.id, storageKey, mimeType: "image/webp", bytes, ready: true },
      });
      await tx.storageQuota.update({
        where: { userId: uploader.id },
        data: { usedBytes: { increment: bytes } },
      });
    });
  } catch (error) {
    if (created) {
      // A dropped connection can obscure the result of COMMIT.
      try {
        const committed = await db.media.findUnique({ where: { id }, select: { id: true } });
        if (!committed) await unlink(path);
      } catch {
        console.error("Media upload needs file reconciliation", id);
      }
    }
    throw error;
  }
  return { url: imageUrl(id) };
}

export async function readImage(
  db: PrismaClient,
  id: string,
  getActor: () => Promise<Actor | null>,
) {
  const root = mediaRoot();
  if (!root || !imageIdFromUrl(imageUrl(id))) return null;
  const image = await db.media.findUnique({
    where: { id, ready: true },
    select: {
      ownerId: true,
      storageKey: true,
      mimeType: true,
      revisions: {
        where: { state: "PUBLISHED" },
        select: { version: true, content: { select: { publishedVersion: true } } },
      },
    },
  });
  if (!image || image.storageKey !== `${id}.webp` || image.mimeType !== "image/webp") return null;
  if (!image.revisions.some((revision) => revision.version === revision.content.publishedVersion)) {
    const actor = await getActor();
    if (!actor || actor.banned) return null;
    if (actor.id !== image.ownerId && !authorize(actor, "site.manage").allowed) return null;
  }
  try {
    // Runtime media lives outside the build output.
    const path = join(/*turbopackIgnore: true*/ root, image.storageKey);
    return await readFile(/*turbopackIgnore: true*/ path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
