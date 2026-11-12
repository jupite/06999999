import { getDb } from "@/server/db";
import { assignUserRole } from "@/server/services/roles";
import { roleRequest, roleBody, roleHeaders } from "@/server/http/roles";
export function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return roleRequest(request, true, async (actor) => {
    const { id } = await context.params,
      body = await roleBody(request);
    return Response.json(await getDb().$transaction((tx) => assignUserRole(tx, actor, id, body)), {
      headers: roleHeaders,
    });
  });
}
