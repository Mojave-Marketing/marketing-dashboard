import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return new NextResponse(errorPage(error || "No code returned from Buffer"), {
      headers: { "Content-Type": "text/html" },
    });
  }

  const clientId = process.env.BUFFER_CLIENT_ID;
  const clientSecret = process.env.BUFFER_SECRET_ID;
  const redirectUri = `${origin}/api/auth/buffer/callback`;

  try {
    const res = await fetch("https://api.bufferapp.com/1/oauth2/token.json", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
        grant_type: "authorization_code",
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.access_token) {
      throw new Error(data.error || data.error_description || `HTTP ${res.status}`);
    }

    return new NextResponse(successPage(data.access_token), {
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    return new NextResponse(errorPage(err.message), {
      headers: { "Content-Type": "text/html" },
    });
  }
}

function successPage(token) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Buffer Connected</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 60px auto; padding: 0 24px; color: #111; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    p { color: #555; margin-bottom: 16px; }
    .token-box { background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 13px; word-break: break-all; margin-bottom: 16px; }
    ol { color: #555; line-height: 1.8; }
    code { background: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
  </style>
</head>
<body>
  <h1>Buffer connected ✓</h1>
  <p>Copy the access token below and save it as <code>BUFFER_API</code> in your Vercel environment variables.</p>
  <div class="token-box">${token}</div>
  <ol>
    <li>Go to your <a href="https://vercel.com" target="_blank">Vercel dashboard</a></li>
    <li>Open the <strong>marketing-dashboard</strong> project → Settings → Environment Variables</li>
    <li>Add or update <code>BUFFER_API</code> with the token above</li>
    <li>Redeploy the project for the change to take effect</li>
  </ol>
</body>
</html>`;
}

function errorPage(message) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Buffer Auth Error</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 60px auto; padding: 0 24px; color: #111; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    .error { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 13px; color: #b91c1c; margin-bottom: 16px; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>Buffer auth failed</h1>
  <div class="error">${message}</div>
  <p><a href="/api/auth/buffer">Try again</a></p>
</body>
</html>`;
}
