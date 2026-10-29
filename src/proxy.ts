import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, locales } from "@/lib/config";

function getLocale(request: NextRequest) {
  const accept = request.headers.get("accept-language") ?? "";
  // Serbian, plus the closely related languages people in the region use.
  return /^(sr|hr|bs|me|sh)\b/i.test(accept.trim()) ? "sr" : defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return;

  request.nextUrl.pathname = `/${getLocale(request)}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: ["/((?!api|monitoring|_next|manifest.webmanifest|icon|apple-icon|favicon.ico|.*\\..*).*)"],
};
