import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { readImage } from "@/server/services/media";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!process.env.DATABASE_URL) return new Response(null, { status: 404, headers });
  const image = await readImage(getDb(), (await params).id, currentActor);
  if (!image) return new Response(null, { status: 404, headers });
  return new Response(new Uint8Array(image), {
    headers: { ...headers, "Content-Type": "image/webp", "X-Content-Type-Options": "nosniff" },
  });
}
