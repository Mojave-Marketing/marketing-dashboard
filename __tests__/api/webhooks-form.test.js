/**
 * @jest-environment node
 */

const mockPut = jest.fn();
jest.mock("@vercel/blob", () => ({
  put: (...args) => mockPut(...args),
  list: jest.fn(),
}));

const { POST, GET } = require("../../app/api/webhooks/form/[formId]/route");

function postReq(payload, { secret, formId = "rep-feedback" } = {}) {
  const url = new URL(`http://localhost:3000/api/webhooks/form/${formId}`);
  if (secret !== undefined) url.searchParams.set("secret", secret);
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload === undefined ? "" : JSON.stringify(payload),
  });
}

describe("GET /api/webhooks/form/[formId]", () => {
  it("returns a health check ok", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});

describe("POST /api/webhooks/form/[formId]", () => {
  const originalSecret = process.env.WEBHOOK_SECRET;

  beforeEach(() => {
    mockPut.mockReset();
    mockPut.mockResolvedValue({ url: "https://blob.example.com/x.json" });
    process.env.WEBHOOK_SECRET = "test-secret";
  });

  afterAll(() => {
    process.env.WEBHOOK_SECRET = originalSecret;
  });

  it("rejects with 401 when the secret query param is missing", async () => {
    const res = await POST(postReq({ q1: "yes" }), { params: { formId: "f" } });
    expect(res.status).toBe(401);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the secret is wrong", async () => {
    const res = await POST(postReq({ q1: "yes" }, { secret: "wrong" }), { params: { formId: "f" } });
    expect(res.status).toBe(401);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("allows requests when WEBHOOK_SECRET is unset", async () => {
    delete process.env.WEBHOOK_SECRET;
    const res = await POST(postReq({ q1: "yes" }), { params: { formId: "f" } });
    expect(res.status).toBe(200);
    expect(mockPut).toHaveBeenCalled();
  });

  it("returns 400 on invalid JSON body", async () => {
    const bad = new Request("http://localhost:3000/api/webhooks/form/f?secret=test-secret", {
      method: "POST",
      body: "{bad json",
    });
    const res = await POST(bad, { params: { formId: "f" } });
    expect(res.status).toBe(400);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("writes one blob per submission under surveys/{formId}/{timestamp}.json", async () => {
    const before = Date.now();
    const res = await POST(
      postReq({ name: "Jane", rating: 9 }, { secret: "test-secret" }),
      { params: { formId: "arctidry-feedback" } }
    );
    const after = Date.now();

    expect(res.status).toBe(200);
    expect(mockPut).toHaveBeenCalledTimes(1);
    const [key, body, opts] = mockPut.mock.calls[0];
    expect(key).toMatch(/^surveys\/arctidry-feedback\/\d+\.json$/);
    const ts = Number(key.split("/")[2].replace(".json", ""));
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
    expect(opts).toMatchObject({
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
    });
    const stored = JSON.parse(body);
    expect(stored.name).toBe("Jane");
    expect(stored.rating).toBe(9);
    expect(typeof stored._receivedAt).toBe("string");
    expect(() => new Date(stored._receivedAt)).not.toThrow();
  });
});
