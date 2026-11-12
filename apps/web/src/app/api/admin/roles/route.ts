import { getDb } from "@/server/db";
import { listRoles, createRole } from "@/server/services/roles";
import { roleRequest, roleBody, roleHeaders } from "@/server/http/roles";
export function GET(request: Request) {
  return roleRequest(request, false, async (actor) =>
    Response.json({ roles: await listRoles(getDb(), actor) }, { headers: roleHeaders }),
  );
}
export function POST(request: Request) {
  return roleRequest(request, true, async (actor) => {
    const body = await roleBody(request);
    return Response.json(await getDb().$transaction((tx) => createRole(tx, actor, body)), {
      status: 201,
      headers: roleHeaders,
    });
  });
}
