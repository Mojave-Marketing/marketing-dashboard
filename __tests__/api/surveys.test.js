/**
 * @jest-environment node
 */

jest.mock("@vercel/blob", () => ({
  list: jest.fn(),
  put: jest.fn(),
}));

const { list: mockList } = require("@vercel/blob");
const { GET } = require("../../app/api/surveys/[formId]/route");

const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
const originalFetch = global.fetch;

function fakeReq() {
  return new Request("http://localhost:3000/api/surveys/arctidry-feedback");
}

describe("GET /api/surveys/[formId]", () => {
  beforeEach(() => {
    mockList.mockReset();
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_token";
    global.fetch = jest.fn();
  });

  afterAll(() => {
    process.env.BLOB_READ_WRITE_TOKEN = originalToken;
    global.fetch = originalFetch;
  });

  it("returns unconfigured when BLOB_READ_WRITE_TOKEN is unset", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const res = await GET(fakeReq(), { params: { formId: "f" } });
    const body = await res.json();
    expect(body).toEqual({ responses: [], total: 0, unconfigured: true });
    expect(mockList).not.toHaveBeenCalled();
  });

  it("returns empty when no blobs exist under the prefix", async () => {
    mockList.mockResolvedValue({ blobs: [] });
    const res = await GET(fakeReq(), { params: { formId: "arctidry-feedback" } });
    expect(mockList).toHaveBeenCalledWith({ prefix: "surveys/arctidry-feedback/" });
    const body = await res.json();
    expect(body).toEqual({ responses: [], total: 0 });
  });

  it("fetches each blob, filters out failed fetches, and sorts newest first", async () => {
    mockList.mockResolvedValue({
      blobs: [
        { url: "https://blob/old.json" },
        { url: "https://blob/new.json" },
        { url: "https://blob/broken.json" },
      ],
    });
    global.fetch
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ name: "Old", _receivedAt: "2026-01-01T00:00:00Z" }),
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ name: "New", _receivedAt: "2026-09-01T00:00:00Z" }),
        })
      )
      .mockImplementationOnce(() => Promise.resolve({ ok: false }));

    const res = await GET(fakeReq(), { params: { formId: "f" } });
    const body = await res.json();

    expect(body.total).toBe(2);
    expect(body.responses.map((r) => r.name)).toEqual(["New", "Old"]);
    // All blob fetches must carry the Bearer token (private blob access).
    for (const call of global.fetch.mock.calls) {
      expect(call[1].headers.Authorization).toBe("Bearer vercel_blob_rw_token");
    }
  });

  it("returns 500 when the blob list call throws", async () => {
    const originalError = console.error;
    console.error = jest.fn();
    mockList.mockRejectedValue(new Error("storage down"));
    const res = await GET(fakeReq(), { params: { formId: "f" } });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/storage down/);
    console.error = originalError;
  });
});
