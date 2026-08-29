import { NextResponse } from "next/server";

export async function GET(request) {
  const clientId = process.env.BUFFER_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "BUFFER_CLIENT_ID not configured" }, { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/buffer/callback`;

  const authUrl = new URL("https://bufferapp.com/oauth2/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");

  return NextResponse.redirect(authUrl.toString());
}
