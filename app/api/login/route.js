import { NextResponse } from "next/server";
import { createToken, EXPIRY_SECONDS } from "../../../lib/session";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { password } = body;

  if (!password || password !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.error("SESSION_SECRET env var is not set");
    return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });
  }

  const token = await createToken(secret);

  const res = NextResponse.json({ ok: true });
  res.cookies.set("__session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: EXPIRY_SECONDS,
    path: "/",
  });
  return res;
}
