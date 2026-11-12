import { getDb } from "@/server/db";
import { getRole, updateRole, deleteRole } from "@/server/services/roles";
import { roleRequest, roleBody, roleHeaders } from "@/server/http/roles";
type Context = { params: Promise<{ id: string }> };
export function GET(request: Request, context: Context) {
  return roleRequest(request, false, async (actor) =>
    Response.json(await getRole(getDb(), actor, (await context.params).id), {
      headers: roleHeaders,
    }),
  );
}
export function PATCH(request: Request, context: Context) {
  return roleRequest(request, true, async (actor) => {
    const { id } = await context.params,
      body = await roleBody(request);
    return Response.json(await getDb().$transaction((tx) => updateRole(tx, actor, id, body)), {
      headers: roleHeaders,
    });
  });
}
export function DELETE(request: Request, context: Context) {
  return roleRequest(request, true, async (actor) => {
    const { id } = await context.params;
    const raw = new URL(request.url).searchParams.get("expectedVersion");
    const version = raw && /^\d+$/.test(raw) ? Number(raw) : NaN;
    await getDb().$transaction((tx) => deleteRole(tx, actor, id, version));
    return new Response(null, { status: 204, headers: roleHeaders });
  });
}
