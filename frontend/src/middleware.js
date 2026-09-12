import { NextResponse } from "next/server";

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("nocr_token")?.value;

  // Root route redirect:
  if (pathname === "/") {
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Protect authenticated routes: if no token, redirect to login immediately
  const protectedPrefixes = [
    "/dashboard",
    "/device",
    "/monitoring",
    "/report",
    "/settings",
    "/sites",
    "/topology",
    "/topologi",
    "/maps",
  ];

  if (protectedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/device/:path*",
    "/monitoring/:path*",
    "/report/:path*",
    "/settings/:path*",
    "/sites/:path*",
    "/topology/:path*",
    "/topologi/:path*",
    "/maps/:path*",
  ],
};
