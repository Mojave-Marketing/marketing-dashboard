/**
 * @jest-environment node
 */

let getLinkedInProfile;
let getLinkedInPosts;
const originalFetch = global.fetch;

// Each lib call either hits the GraphQL endpoint once (if the org id is
// already cached) or twice (once for account/organizations, once for the
// actual query). The helper lets each test enqueue specific responses.
function mockGraphQLOnce(data) {
  global.fetch.mockImplementationOnce(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ data })),
      json: () => Promise.resolve({ data }),
    })
  );
}

function mockGraphQLErrorOnce({ status = 200, errors } = {}) {
  global.fetch.mockImplementationOnce(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(JSON.stringify({ errors })),
      json: () => Promise.resolve({ errors }),
    })
  );
}

function mockHttpErrorOnce(status, body) {
  global.fetch.mockImplementationOnce(() =>
    Promise.resolve({
      ok: false,
      status,
      text: () => Promise.resolve(body),
      json: () => Promise.resolve({}),
    })
  );
}

function mockOrgFetchOnce(orgId = "org-123") {
  mockGraphQLOnce({ account: { organizations: [{ id: orgId, name: "Mojave" }] } });
}

beforeEach(() => {
  jest.resetModules();
  const mod = require("../../lib/buffer");
  getLinkedInProfile = mod.getLinkedInProfile;
  getLinkedInPosts = mod.getLinkedInPosts;

  global.fetch = jest.fn();
  process.env.BUFFER_API = "test-personal-api-key";
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("getLinkedInProfile (GraphQL)", () => {
  it("throws when BUFFER_API is missing", async () => {
    delete process.env.BUFFER_API;
    await expect(getLinkedInProfile()).rejects.toThrow(/BUFFER_API/);
  });

  it("posts to https://api.buffer.com with a Bearer token", async () => {
    mockOrgFetchOnce();
    mockGraphQLOnce({ channels: [{ id: "c1", name: "Mojave", service: "linkedin" }] });
    await getLinkedInProfile();
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe("https://api.buffer.com");
    expect(opts.method).toBe("POST");
    expect(opts.headers.Authorization).toBe("Bearer test-personal-api-key");
    expect(opts.headers["Content-Type"]).toBe("application/json");
  });

  it("resolves the organization id before querying channels", async () => {
    mockOrgFetchOnce("org-abc");
    mockGraphQLOnce({ channels: [{ id: "ch", name: "Mojave", service: "linkedin" }] });
    await getLinkedInProfile();
    // Second request should carry the orgId variable we just fetched
    const secondBody = JSON.parse(global.fetch.mock.calls[1][1].body);
    expect(secondBody.variables.orgId).toBe("org-abc");
    expect(secondBody.query).toContain("channels");
  });

  it("returns null when the organization has no LinkedIn channel", async () => {
    mockOrgFetchOnce();
    mockGraphQLOnce({ channels: [{ id: "x", name: "Twitter", service: "twitter" }] });
    await expect(getLinkedInProfile()).resolves.toBeNull();
  });

  it("matches 'linkedin' and any linkedin-prefixed service (e.g. linkedinPage)", async () => {
    mockOrgFetchOnce();
    mockGraphQLOnce({ channels: [{ id: "ch", name: "Mojave LinkedIn", service: "linkedinPage" }] });
    const profile = await getLinkedInProfile();
    expect(profile.id).toBe("ch");
    expect(profile.name).toBe("Mojave LinkedIn");
  });

  it("returns followers: null since the GraphQL API doesn't expose it", async () => {
    mockOrgFetchOnce();
    mockGraphQLOnce({ channels: [{ id: "ch", name: "x", service: "linkedin" }] });
    const profile = await getLinkedInProfile();
    expect(profile.followers).toBeNull();
  });

  it("caches the profile between calls", async () => {
    mockOrgFetchOnce();
    mockGraphQLOnce({ channels: [{ id: "ch", name: "x", service: "linkedin" }] });
    await getLinkedInProfile();
    await getLinkedInProfile();
    expect(global.fetch).toHaveBeenCalledTimes(2); // org + channels, then cache hit
  });

  it("throws when the account has no organizations", async () => {
    mockGraphQLOnce({ account: { organizations: [] } });
    await expect(getLinkedInProfile()).rejects.toThrow(/No Buffer organizations/);
  });

  it("surfaces GraphQL errors with their message", async () => {
    mockGraphQLErrorOnce({
      errors: [{ message: "Unauthorized" }],
    });
    await expect(getLinkedInProfile()).rejects.toThrow(/Unauthorized/);
  });

  it("surfaces HTTP errors with status", async () => {
    mockHttpErrorOnce(401, "{\"error\":\"token revoked\"}");
    await expect(getLinkedInProfile()).rejects.toThrow(/401/);
  });
});

describe("getLinkedInPosts (GraphQL)", () => {
  it("maps edges.node to the dashboard post shape", async () => {
    mockOrgFetchOnce();
    mockGraphQLOnce({
      posts: {
        edges: [
          {
            node: {
              id: "p1",
              text: "Hello HVAC world",
              sentAt: "2026-10-01T00:00:00Z",
              reactions: 12,
              comments: 3,
              impressions: 1000,
              engagementRate: 0.018,
              metrics: [
                { type: "clicks", value: 25, name: "Link clicks" },
                { type: "shares", value: 4, name: "Reshares" },
              ],
            },
          },
        ],
      },
    });

    const posts = await getLinkedInPosts("ch-123", 25);
    expect(posts).toEqual([
      {
        id: "p1",
        text: "Hello HVAC world",
        sentAt: "2026-10-01T00:00:00Z",
        stats: { impressions: 1000, clicks: 25, reactions: 12, comments: 3, shares: 4 },
      },
    ]);
  });

  it("passes channelId and first count as GraphQL variables", async () => {
    mockOrgFetchOnce();
    mockGraphQLOnce({ posts: { edges: [] } });
    await getLinkedInPosts("ch-xyz", 10);
    const body = JSON.parse(global.fetch.mock.calls[1][1].body);
    expect(body.variables.channelId).toBe("ch-xyz");
    expect(body.variables.first).toBe(10);
    expect(body.query).toContain("posts(");
  });

  it("defaults missing metrics to 0 and tolerates missing fields", async () => {
    mockOrgFetchOnce();
    mockGraphQLOnce({
      posts: { edges: [{ node: { id: "p", text: "", sentAt: null, metrics: [] } }] },
    });
    const [post] = await getLinkedInPosts("ch", 5);
    expect(post.stats).toEqual({ impressions: 0, clicks: 0, reactions: 0, comments: 0, shares: 0 });
    expect(post.sentAt).toBeNull();
  });

  it("accepts 'linkclicks' as an alternate clicks metric name", async () => {
    mockOrgFetchOnce();
    mockGraphQLOnce({
      posts: {
        edges: [
          { node: { id: "p", text: "", sentAt: null, impressions: 100, metrics: [{ type: "linkclicks", value: 7 }] } },
        ],
      },
    });
    const [post] = await getLinkedInPosts("ch", 5);
    expect(post.stats.clicks).toBe(7);
  });

  it("caches posts by channelId", async () => {
    mockOrgFetchOnce();
    mockGraphQLOnce({ posts: { edges: [] } });
    await getLinkedInPosts("ch-cache", 5);
    await getLinkedInPosts("ch-cache", 5);
    expect(global.fetch).toHaveBeenCalledTimes(2); // org + posts, then cache hit
  });
});
