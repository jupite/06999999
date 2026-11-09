import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale } from "@/i18n/messages";
import { localeCookie, localePath } from "@/i18n/routing";

export function proxy(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") return NextResponse.next();

  const preference = request.cookies.get(localeCookie)?.value;
  const locale = isLocale(preference) ? preference : defaultLocale;
  const target = request.nextUrl.clone();
  target.pathname = localePath(locale, target.pathname);
  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    "/",
    "/articles/:path*",
    "/my-articles/:path*",
    "/drafts",
    "/write",
    "/login",
    "/admin/:path*",
    "/projects/:path*",
    "/photos",
    "/music",
    "/friends",
    "/about",
  ],
};
