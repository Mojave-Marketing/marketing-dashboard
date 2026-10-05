import { createToken, verifyToken, EXPIRY_SECONDS } from "../../lib/session";

const SECRET = "unit-test-secret-do-not-use-in-prod";

describe("session tokens", () => {
  it("round-trips: a freshly created token verifies with the same secret", async () => {
    const token = await createToken(SECRET);
    await expect(verifyToken(token, SECRET)).resolves.toBe(true);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createToken(SECRET);
    await expect(verifyToken(token, "different-secret")).resolves.toBe(false);
  });

  it("rejects a token with a tampered timestamp", async () => {
    const token = await createToken(SECRET);
    const [ts, sig] = token.split(".");
    const forged = `${Number(ts) + 1}.${sig}`;
    await expect(verifyToken(forged, SECRET)).resolves.toBe(false);
  });

  it("rejects a token with a tampered signature", async () => {
    const token = await createToken(SECRET);
    const [ts] = token.split(".");
    const forged = `${ts}.AAAA`;
    await expect(verifyToken(forged, SECRET)).resolves.toBe(false);
  });

  it("rejects a token missing the dot separator", async () => {
    await expect(verifyToken("not-a-token", SECRET)).resolves.toBe(false);
  });

  it("rejects an empty token", async () => {
    await expect(verifyToken("", SECRET)).resolves.toBe(false);
  });

  it("rejects a token with non-numeric timestamp", async () => {
    await expect(verifyToken("abc.AAAA", SECRET)).resolves.toBe(false);
  });

  it("rejects a token older than EXPIRY_SECONDS", async () => {
    const expiredTs = Math.floor(Date.now() / 1000) - EXPIRY_SECONDS - 1;
    // Build a token with that timestamp but a valid-shape signature.
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`mojave-session:${expiredTs}`)
    );
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
    const expiredToken = `${expiredTs}.${sigB64}`;
    await expect(verifyToken(expiredToken, SECRET)).resolves.toBe(false);
  });

  it("exports a 7-day expiry", () => {
    expect(EXPIRY_SECONDS).toBe(7 * 24 * 60 * 60);
  });
});
