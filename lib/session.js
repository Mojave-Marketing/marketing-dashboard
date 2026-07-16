// Session token helpers — work in both Edge Runtime (middleware) and
// Node.js runtime (API routes). Both expose the Web Crypto API as
// globalThis.crypto.subtle; no Node-specific imports here.

const EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days
const MSG_PREFIX = "mojave-session:";

async function importKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function createToken(secret) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(MSG_PREFIX + ts)
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${ts}.${sigB64}`;
}

async function verifyToken(token, secret) {
  try {
    const dot = token.indexOf(".");
    if (dot === -1) return false;

    const ts = token.slice(0, dot);
    const sigB64 = token.slice(dot + 1);
    const tsNum = parseInt(ts, 10);

    if (!Number.isFinite(tsNum)) return false;
    if (Math.floor(Date.now() / 1000) - tsNum > EXPIRY_SECONDS) return false;

    const key = await importKey(secret);
    const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
    return crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(MSG_PREFIX + ts)
    );
  } catch {
    return false;
  }
}

export { createToken, verifyToken, EXPIRY_SECONDS };
