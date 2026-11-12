import { getDb } from "@/server/db";
import { effectivePermissions } from "@/server/services/roles";
import { roleRequest, roleHeaders } from "@/server/http/roles";
export function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return roleRequest(request, false, async (actor) =>
    Response.json(await effectivePermissions(getDb(), actor, (await context.params).id), {
      headers: roleHeaders,
    }),
  );
}
