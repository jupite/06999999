import { handleLikeRequest } from "@/server/http/likes";
type Context = { params: Promise<{ slug: string }> };
export async function GET(request: Request, context: Context) {
  return handleLikeRequest(request, (await context.params).slug, "POST", undefined);
}
export async function PUT(request: Request, context: Context) {
  return handleLikeRequest(request, (await context.params).slug, "POST", true);
}
export async function DELETE(request: Request, context: Context) {
  return handleLikeRequest(request, (await context.params).slug, "POST", false);
}
