import { getDb } from "@/server/db";
import { updatePersonalPermission } from "@/server/services/user-permissions";
import { roleRequest, roleBody, roleHeaders } from "@/server/http/roles";
export function PUT(request: Request, context: { params: Promise<{ id: string; key: string }> }) {
  return roleRequest(
    request,
    true,
    async (actor) => {
      const { id, key } = await context.params,
        body = await roleBody(request, "invalidUserAccess");
      return Response.json(
        await getDb().$transaction((tx) => updatePersonalPermission(tx, actor, id, key, body)),
        { headers: roleHeaders },
      );
    },
    "userAccessSaveFailed",
  );
}
