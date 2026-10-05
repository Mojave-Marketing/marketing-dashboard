/**
 * @jest-environment node
 */

jest.mock("../../lib/buffer", () => ({
  getLinkedInProfile: jest.fn(),
  getLinkedInPosts: jest.fn(),
}));

const buffer = require("../../lib/buffer");
const { GET } = require("../../app/api/linkedin/route");

describe("GET /api/linkedin", () => {
  const originalApi = process.env.BUFFER_API;
  const originalError = console.error;
  beforeEach(() => {
    buffer.getLinkedInProfile.mockReset();
    buffer.getLinkedInPosts.mockReset();
    console.error = jest.fn();
    process.env.BUFFER_API = "token";
  });
  afterAll(() => {
    process.env.BUFFER_API = originalApi;
    console.error = originalError;
  });

  it("returns 404 when BUFFER_API is unset", async () => {
    delete process.env.BUFFER_API;
    const res = await GET();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/BUFFER_API/);
  });

  it("returns 404 when no LinkedIn profile is connected", async () => {
    buffer.getLinkedInProfile.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("computes avgImpressions, totalClicks, avgEngagementRate correctly", async () => {
    buffer.getLinkedInProfile.mockResolvedValue({ id: "li", name: "Mojave", followers: 500 });
    buffer.getLinkedInPosts.mockResolvedValue([
      // post A: 1000 impressions, 10 clicks + 5 reactions + 2 comments + 1 share = 18 → 1.8%
      { id: "a", text: "a", sentAt: "x", stats: { impressions: 1000, clicks: 10, reactions: 5, comments: 2, shares: 1 } },
      // post B: 500 impressions, 5+2+1+0 = 8 → 1.6%
      { id: "b", text: "b", sentAt: "x", stats: { impressions: 500, clicks: 5, reactions: 2, comments: 1, shares: 0 } },
      // post C: 0 impressions — must be excluded from averages but clicks still counted
      { id: "c", text: "c", sentAt: "x", stats: { impressions: 0, clicks: 3, reactions: 0, comments: 0, shares: 0 } },
    ]);

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.profile).toEqual({ name: "Mojave", followers: 500 });
    expect(body.summary.postsAnalyzed).toBe(2);
    expect(body.summary.totalPostsFetched).toBe(3);
    expect(body.summary.avgImpressions).toBe(750);
    expect(body.summary.totalClicks).toBe(18); // 10 + 5 + 3
    expect(body.summary.avgEngagementRate).toBeCloseTo((0.018 + 0.016) / 2);
  });

  it("returns zeroed summary when all posts have zero impressions", async () => {
    buffer.getLinkedInProfile.mockResolvedValue({ id: "li", name: "x", followers: 1 });
    buffer.getLinkedInPosts.mockResolvedValue([
      { id: "a", text: "a", sentAt: "x", stats: { impressions: 0, clicks: 0, reactions: 0, comments: 0, shares: 0 } },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body.summary.postsAnalyzed).toBe(0);
    expect(body.summary.avgImpressions).toBe(0);
    expect(body.summary.avgEngagementRate).toBe(0);
  });

  it("returns 500 when the Buffer lib throws", async () => {
    buffer.getLinkedInProfile.mockRejectedValue(new Error("buffer down"));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/buffer down/);
  });
});
