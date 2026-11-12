import { handleLikeRequest } from "@/server/http/likes";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return handleLikeRequest(request, (await context.params).id, "PROJECT", undefined);
}
export async function PUT(request: Request, context: Context) {
  return handleLikeRequest(request, (await context.params).id, "PROJECT", true);
}
export async function DELETE(request: Request, context: Context) {
  return handleLikeRequest(request, (await context.params).id, "PROJECT", false);
}
