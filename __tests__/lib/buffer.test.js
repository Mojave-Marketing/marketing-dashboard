/**
 * @jest-environment node
 */

let getLinkedInProfile;
let getLinkedInPosts;
const originalFetch = global.fetch;

function mockFetchOnce(body, { status = 200 } = {}) {
  global.fetch.mockImplementationOnce(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
      json: () => Promise.resolve(body),
    })
  );
}

beforeEach(() => {
  jest.resetModules();
  const mod = require("../../lib/buffer");
  getLinkedInProfile = mod.getLinkedInProfile;
  getLinkedInPosts = mod.getLinkedInPosts;

  global.fetch = jest.fn();
  process.env.BUFFER_API = "buffer-token-xyz";
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("getLinkedInProfile", () => {
  it("throws when BUFFER_API is missing", async () => {
    delete process.env.BUFFER_API;
    await expect(getLinkedInProfile()).rejects.toThrow(/BUFFER_API/);
  });

  it("returns null when no LinkedIn profile is connected in Buffer", async () => {
    mockFetchOnce([{ id: "x", service: "twitter" }]);
    await expect(getLinkedInProfile()).resolves.toBeNull();
  });

  it("picks the service='linkedin' profile", async () => {
    mockFetchOnce([
      { id: "t", service: "twitter", service_username: "foo", statistics: { followers: 5 } },
      {
        id: "li",
        service: "linkedin",
        service_username: "mojave",
        statistics: { followers: 1234 },
      },
    ]);
    await expect(getLinkedInProfile()).resolves.toEqual({
      id: "li",
      name: "mojave",
      followers: 1234,
    });
  });

  it("also accepts service='linkedin-business'", async () => {
    mockFetchOnce([
      { id: "li2", service: "linkedin-business", formatted_username: "Mojave HVAC", statistics: {} },
    ]);
    const p = await getLinkedInProfile();
    expect(p.id).toBe("li2");
    expect(p.name).toBe("Mojave HVAC");
    expect(p.followers).toBeNull();
  });

  it("caches the profile result", async () => {
    mockFetchOnce([{ id: "li", service: "linkedin", statistics: { followers: 1 } }]);
    await getLinkedInProfile();
    await getLinkedInProfile();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("includes access_token in the URL", async () => {
    mockFetchOnce([{ id: "li", service: "linkedin", statistics: {} }]);
    await getLinkedInProfile();
    expect(global.fetch.mock.calls[0][0]).toContain("access_token=buffer-token-xyz");
  });
});

describe("getLinkedInPosts", () => {
  it("maps Buffer update fields to the post shape", async () => {
    const sentAt = 1_700_000_000; // seconds
    mockFetchOnce({
      updates: [
        {
          id: "u1",
          text: "Hello world",
          sent_at: sentAt,
          statistics: {
            reach: 500,
            clicks: 25,
            favorites: 10,
            comments: 2,
            retweets: 3,
          },
        },
      ],
    });

    const posts = await getLinkedInPosts("profile-id", 25);
    expect(posts).toEqual([
      {
        id: "u1",
        text: "Hello world",
        sentAt: new Date(sentAt * 1000).toISOString(),
        stats: { impressions: 500, clicks: 25, reactions: 10, comments: 2, shares: 3 },
      },
    ]);
  });

  it("handles bare-array response shape", async () => {
    mockFetchOnce([
      { id: "u2", text: "", sent_at: null, statistics: {} },
    ]);
    const posts = await getLinkedInPosts("profile-id");
    expect(posts).toHaveLength(1);
    expect(posts[0].sentAt).toBeNull();
    expect(posts[0].stats).toEqual({ impressions: 0, clicks: 0, reactions: 0, comments: 0, shares: 0 });
  });

  it("caches posts per profileId", async () => {
    mockFetchOnce({ updates: [] });
    await getLinkedInPosts("p1");
    await getLinkedInPosts("p1");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("passes count in the query string", async () => {
    mockFetchOnce({ updates: [] });
    await getLinkedInPosts("p2", 10);
    expect(global.fetch.mock.calls[0][0]).toContain("count=10");
  });
});
