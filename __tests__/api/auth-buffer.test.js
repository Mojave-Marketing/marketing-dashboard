/**
 * @jest-environment node
 */

const { GET: GET_initiate } = require("../../app/api/auth/buffer/route");
const { GET: GET_callback } = require("../../app/api/auth/buffer/callback/route");

const originalFetch = global.fetch;

describe("GET /api/auth/buffer (initiate)", () => {
  const originalClient = process.env.BUFFER_CLIENT_ID;
  beforeEach(() => {
    process.env.BUFFER_CLIENT_ID = "client-123";
  });
  afterAll(() => {
    process.env.BUFFER_CLIENT_ID = originalClient;
  });

  it("returns 500 when BUFFER_CLIENT_ID is unset", async () => {
    delete process.env.BUFFER_CLIENT_ID;
    const res = await GET_initiate(new Request("http://localhost:3000/api/auth/buffer"));
    expect(res.status).toBe(500);
  });

  it("redirects to bufferapp.com/oauth2/authorize with the right params", async () => {
    const res = await GET_initiate(new Request("http://localhost:3000/api/auth/buffer"));
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get("location"));
    expect(loc.origin + loc.pathname).toBe("https://bufferapp.com/oauth2/authorize");
    expect(loc.searchParams.get("client_id")).toBe("client-123");
    expect(loc.searchParams.get("response_type")).toBe("code");
    expect(loc.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/buffer/callback");
  });
});

describe("GET /api/auth/buffer/callback", () => {
  const originalClient = process.env.BUFFER_CLIENT_ID;
  const originalSecret = process.env.BUFFER_SECRET_ID;

  beforeEach(() => {
    process.env.BUFFER_CLIENT_ID = "client-123";
    process.env.BUFFER_SECRET_ID = "secret-456";
    global.fetch = jest.fn();
  });
  afterAll(() => {
    process.env.BUFFER_CLIENT_ID = originalClient;
    process.env.BUFFER_SECRET_ID = originalSecret;
    global.fetch = originalFetch;
  });

  it("renders an error page when Buffer returns an error query param", async () => {
    const res = await GET_callback(
      new Request("http://localhost:3000/api/auth/buffer/callback?error=access_denied")
    );
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toMatch(/Buffer auth failed/);
    expect(html).toMatch(/access_denied/);
  });

  it("renders an error page when no code is present", async () => {
    const res = await GET_callback(new Request("http://localhost:3000/api/auth/buffer/callback"));
    const html = await res.text();
    expect(html).toMatch(/No code returned/);
  });

  it("exchanges the code for a token and renders the success page", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ access_token: "token-xyz" }),
    });
    const res = await GET_callback(
      new Request("http://localhost:3000/api/auth/buffer/callback?code=abc123")
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.bufferapp.com/1/oauth2/token.json",
      expect.objectContaining({ method: "POST" })
    );
    const html = await res.text();
    expect(html).toMatch(/Buffer connected/);
    expect(html).toMatch(/token-xyz/);
  });

  it("renders the error page when Buffer returns a non-ok token response", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: "invalid_grant" }),
    });
    const res = await GET_callback(
      new Request("http://localhost:3000/api/auth/buffer/callback?code=abc123")
    );
    const html = await res.text();
    expect(html).toMatch(/Buffer auth failed/);
    expect(html).toMatch(/invalid_grant/);
  });
});
