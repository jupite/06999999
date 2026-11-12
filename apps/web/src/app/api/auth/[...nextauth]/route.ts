import NextAuth from "next-auth";
import { authConfigured, authOptions } from "@/server/auth";
import type { NextRequest } from "next/server";
const handler = NextAuth(authOptions);
async function route(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  if (!authConfigured()) return Response.json({ error: "登录服务尚未配置" }, { status: 503 });
  return handler(request, context);
}
export { route as GET, route as POST };
