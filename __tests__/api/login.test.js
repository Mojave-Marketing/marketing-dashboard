/**
 * @jest-environment node
 */
import { POST as login } from "../../app/api/login/route";
import { POST as logout } from "../../app/api/logout/route";
import { verifyToken } from "../../lib/session";

const PASSWORD = "unit-password";
const SECRET = "unit-secret-32-bytes-of-entropy!!";

function req(body) {
  return new Request("http://localhost:3000/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("POST /api/login", () => {
  const originalPassword = process.env.DASHBOARD_PASSWORD;
  const originalSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.DASHBOARD_PASSWORD = PASSWORD;
    process.env.SESSION_SECRET = SECRET;
  });

  afterAll(() => {
    process.env.DASHBOARD_PASSWORD = originalPassword;
    process.env.SESSION_SECRET = originalSecret;
  });

  it("sets a valid __session cookie on correct password", async () => {
    const res = await login(req({ password: PASSWORD }));
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toMatch(/__session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=lax/i);

    const token = decodeURIComponent(setCookie.match(/__session=([^;]+)/)[1]);
    await expect(verifyToken(token, SECRET)).resolves.toBe(true);
  });

  it("returns 401 on wrong password", async () => {
    const res = await login(req({ password: "wrong" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
    const body = await res.json();
    expect(body.error).toMatch(/incorrect/i);
  });

  it("returns 401 when password is missing", async () => {
    const res = await login(req({}));
    expect(res.status).toBe(401);
  });

  it("returns 401 when body is malformed JSON", async () => {
    const bad = new Request("http://localhost:3000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    const res = await login(bad);
    expect(res.status).toBe(401);
  });

  it("returns 500 when SESSION_SECRET is missing", async () => {
    const originalError = console.error;
    console.error = jest.fn();
    delete process.env.SESSION_SECRET;
    const res = await login(req({ password: PASSWORD }));
    expect(res.status).toBe(500);
    console.error = originalError;
  });
});

describe("POST /api/logout", () => {
  it("clears the __session cookie", async () => {
    const res = await logout();
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toMatch(/__session=;/);
    expect(setCookie).toMatch(/Max-Age=0/i);
  });
});
