/**
 * @jest-environment node
 */

// next/server requires a Request global; jsdom provides one, node 20+ provides one.
import { middleware } from "../middleware";
import { createToken } from "../lib/session";

const SECRET = "middleware-test-secret";
const ORIGIN = "http://localhost:3000";

function buildRequest(pathname, { cookie } = {}) {
  const url = `${ORIGIN}${pathname}`;
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  // Next's middleware expects a NextRequest-like object. The real NextRequest
  // wraps the standard Request and adds .nextUrl and .cookies — we construct a
  // minimal shape that matches what middleware.js actually touches.
  return {
    nextUrl: new URL(url),
    url,
    cookies: {
      get(name) {
        if (!cookie) return undefined;
        const match = cookie.split(";").map((s) => s.trim()).find((c) => c.startsWith(name + "="));
        return match ? { value: match.slice(name.length + 1) } : undefined;
      },
    },
  };
}

describe("middleware", () => {
  const originalSecret = process.env.SESSION_SECRET;
  beforeEach(() => {
    process.env.SESSION_SECRET = SECRET;
  });
  afterAll(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  describe("public prefixes", () => {
    it.each([
      ["/login"],
      ["/login/anything"],
      ["/api/login"],
      ["/api/webhooks/form/foo"],
      ["/api/auth/buffer"],
      ["/api/auth/buffer/callback"],
    ])("allows %s through without a session cookie", async (path) => {
      const res = await middleware(buildRequest(path));
      // NextResponse.next() has no Location header; a redirect would.
      expect(res.headers.get("location")).toBeNull();
    });
  });

  describe("protected routes", () => {
    it("redirects to /login when no cookie is present", async () => {
      const res = await middleware(buildRequest("/"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe(`${ORIGIN}/login`);
    });

    it("redirects to /login when the cookie is malformed", async () => {
      const res = await middleware(buildRequest("/emails", { cookie: "__session=garbage" }));
      expect(res.headers.get("location")).toBe(`${ORIGIN}/login`);
    });

    it("redirects to /login when SESSION_SECRET is unset", async () => {
      delete process.env.SESSION_SECRET;
      const token = await createToken(SECRET);
      const res = await middleware(buildRequest("/", { cookie: `__session=${token}` }));
      expect(res.headers.get("location")).toBe(`${ORIGIN}/login`);
    });

    it("allows through when a valid token is present", async () => {
      const token = await createToken(SECRET);
      const res = await middleware(buildRequest("/emails", { cookie: `__session=${token}` }));
      expect(res.headers.get("location")).toBeNull();
    });

    it("redirects when the token is signed with a different secret", async () => {
      const token = await createToken("wrong-secret");
      const res = await middleware(buildRequest("/", { cookie: `__session=${token}` }));
      expect(res.headers.get("location")).toBe(`${ORIGIN}/login`);
    });
  });

  describe("public asset gap (regression)", () => {
    // Documents the known bug flagged in the review: /logo.jpg is used by the
    // login page but the middleware matcher does not exclude it and the public
    // allowlist does not include it, so unauthenticated requests redirect.
    it("currently redirects /logo.jpg (bug — should allow)", async () => {
      const res = await middleware(buildRequest("/logo.jpg"));
      expect(res.headers.get("location")).toBe(`${ORIGIN}/login`);
    });
  });
});
