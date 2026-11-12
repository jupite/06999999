import "server-only";
import type { Actor } from "../../domain/permissions";
import { authorize } from "../../domain/permissions";
import { currentActor } from "../../auth";
import { RoleError } from "../../services/roles";
export const roleHeaders = { "Cache-Control": "private, no-store" };
export async function roleRequest(
  request: Request,
  write: boolean,
  run: (actor: Actor) => Promise<Response>,
) {
  if (write) {
    const site = request.headers.get("sec-fetch-site"),
      origin = request.headers.get("origin");
    if (site ? site !== "same-origin" : origin && origin !== new URL(request.url).origin)
      return Response.json({ error: "permissionDenied" }, { status: 403, headers: roleHeaders });
  }
  try {
    const actor = await currentActor(),
      access = authorize(actor, "site.manage");
    if (!actor || !access.allowed) throw new RoleError(access.reason, actor ? 403 : 401);
    return await run(actor);
  } catch (error) {
    if (!(error instanceof RoleError)) console.error("Role request failed", error);
    return Response.json(
      { error: error instanceof RoleError ? error.key : "roleRequestFailed" },
      { status: error instanceof RoleError ? error.status : 500, headers: roleHeaders },
    );
  }
}
export async function roleBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new RoleError("roleInvalid", 400);
  const reader = request.body?.getReader();
  if (!reader) throw new RoleError("roleInvalid", 400);
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 8192) {
        await reader.cancel();
        throw new RoleError("roleInvalid", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RoleError("roleInvalid", 400);
  }
}
