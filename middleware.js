import { NextResponse } from "next/server";
import { verifyToken } from "./lib/session";

const PUBLIC_PREFIXES = ["/login", "/api/login", "/api/webhooks", "/api/auth/buffer", "/logo.jpg"];

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
