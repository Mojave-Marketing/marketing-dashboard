import { NextResponse } from "next/server";
import { verifyToken } from "./lib/session";

// Paths that are always public — no session cookie required.
const PUBLIC_PREFIXES = ["/login", "/api/login"];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("__session")?.value;
  const secret = process.env.SESSION_SECRET;

  if (token && secret && (await verifyToken(token, secret))) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Run on every route except Next.js internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
