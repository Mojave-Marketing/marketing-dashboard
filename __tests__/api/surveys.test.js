/**
 * @jest-environment node
 */

jest.mock("@vercel/blob", () => ({
  list: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
}));

const { list: mockList, get: mockGet } = require("@vercel/blob");
const { GET } = require("../../app/api/surveys/[formId]/route");

function fakeReq() {
  return new Request("http://localhost:3000/api/surveys/arctidry-feedback");
}

function streamOf(obj) {
  // Match what @vercel/blob get() returns on 200: a ReadableStream<Uint8Array>.
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

describe("GET /api/surveys/[formId]", () => {
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;

  beforeEach(() => {
    mockList.mockReset();
    mockGet.mockReset();
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_token";
  });

  afterAll(() => {
    process.env.BLOB_READ_WRITE_TOKEN = originalToken;
  });

  it("returns unconfigured when BLOB_READ_WRITE_TOKEN is unset", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const res = await GET(fakeReq(), { params: { formId: "f" } });
    const body = await res.json();
    expect(body).toEqual({ responses: [], total: 0, unconfigured: true });
    expect(mockList).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("returns empty when no blobs exist under the prefix", async () => {
    mockList.mockResolvedValue({ blobs: [] });
    const res = await GET(fakeReq(), { params: { formId: "arctidry-feedback" } });
    expect(mockList).toHaveBeenCalledWith({ prefix: "surveys/arctidry-feedback/" });
    const body = await res.json();
    expect(body).toEqual({ responses: [], total: 0 });
  });

  it("retrieves each private blob via get(pathname, {access:'private'}), skips misses, sorts newest first", async () => {
    mockList.mockResolvedValue({
      blobs: [
        { pathname: "surveys/f/1.json", url: "https://blob/1.json" },
        { pathname: "surveys/f/2.json", url: "https://blob/2.json" },
        { pathname: "surveys/f/3.json", url: "https://blob/3.json" },
      ],
    });
    mockGet
      .mockImplementationOnce(() =>
        Promise.resolve({
          statusCode: 200,
          stream: streamOf({ name: "Old", _receivedAt: "2026-01-01T00:00:00Z" }),
          headers: new Headers(),
          blob: {},
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          statusCode: 200,
          stream: streamOf({ name: "New", _receivedAt: "2026-09-01T00:00:00Z" }),
          headers: new Headers(),
          blob: {},
        })
      )
      .mockImplementationOnce(() => Promise.resolve(null));

    const res = await GET(fakeReq(), { params: { formId: "f" } });
    const body = await res.json();

    expect(body.total).toBe(2);
    expect(body.responses.map((r) => r.name)).toEqual(["New", "Old"]);

    // Each get call must specify access: 'private' and the blob pathname.
    for (const call of mockGet.mock.calls) {
      expect(call[0]).toMatch(/^surveys\/f\/\d\.json$/);
      expect(call[1]).toEqual(expect.objectContaining({ access: "private" }));
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
