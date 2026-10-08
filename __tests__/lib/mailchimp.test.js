/**
 * @jest-environment node
 */

// Reset the module registry per test so the in-memory cache in lib/cache.js
// doesn't bleed between cases.
let listRepTrainingCampaigns;
let getCampaignReport;
let getCampaignClickDetails;
let getCampaignEmailActivity;
let getListMemberProfiles;
let getCampaignPollResults;

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
  const mod = require("../../lib/mailchimp");
  listRepTrainingCampaigns = mod.listRepTrainingCampaigns;
  getCampaignReport = mod.getCampaignReport;
  getCampaignClickDetails = mod.getCampaignClickDetails;
  getCampaignEmailActivity = mod.getCampaignEmailActivity;
  getListMemberProfiles = mod.getListMemberProfiles;
  getCampaignPollResults = mod.getCampaignPollResults;

  global.fetch = jest.fn();
  process.env.MAILCHIMP_API_KEY = "test-api-key-us21";
  process.env.MAILCHIMP_SERVER_PREFIX = "us21";
  delete process.env.MAILCHIMP_FILTER_MODE;
  delete process.env.MAILCHIMP_TITLE_MATCH;
  delete process.env.MAILCHIMP_TITLE_EXCLUDE;
  delete process.env.MAILCHIMP_FOLDER_ID;
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("listRepTrainingCampaigns", () => {
  it("throws when MAILCHIMP_API_KEY is missing", async () => {
    delete process.env.MAILCHIMP_API_KEY;
    await expect(listRepTrainingCampaigns()).rejects.toThrow(/MAILCHIMP_API_KEY/);
  });

  it("throws when MAILCHIMP_SERVER_PREFIX is missing", async () => {
    delete process.env.MAILCHIMP_SERVER_PREFIX;
    await expect(listRepTrainingCampaigns()).rejects.toThrow(/MAILCHIMP_SERVER_PREFIX/);
  });

  it("hits the correct URL with Basic auth and status=sent", async () => {
    mockFetchOnce({ campaigns: [] });
    await listRepTrainingCampaigns({ mode: "title", titleMatch: "", titleExclude: "" });
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain("https://us21.api.mailchimp.com/3.0/campaigns");
    expect(url).toContain("status=sent");
    expect(url).toContain("sort_field=send_time");
    expect(url).toContain("sort_dir=DESC");
    const expected = "Basic " + Buffer.from("anystring:test-api-key-us21").toString("base64");
    expect(opts.headers.Authorization).toBe(expected);
  });

  it("filters by titleMatch (case-insensitive) when mode=title", async () => {
    mockFetchOnce({
      campaigns: [
        { id: "a", settings: { title: "Rep Training: Week 1" } },
        { id: "b", settings: { title: "Marketing Newsletter" } },
        { id: "c", settings: { title: "REP TRAINING: Week 2" } },
      ],
    });
    const result = await listRepTrainingCampaigns({ mode: "title", titleMatch: "rep training" });
    expect(result.map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("filters out titles matching titleExclude", async () => {
    mockFetchOnce({
      campaigns: [
        { id: "a", settings: { title: "Rep Training" } },
        { id: "b", settings: { title: "Internal: Draft" } },
        { id: "c", settings: { title: "Rep Training 2" } },
      ],
    });
    const result = await listRepTrainingCampaigns({ mode: "title", titleMatch: "", titleExclude: "internal:" });
    expect(result.map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("adds folder_id to the request when mode=folder", async () => {
    mockFetchOnce({ campaigns: [] });
    await listRepTrainingCampaigns({ mode: "folder", folderId: "fld_123" });
    expect(global.fetch.mock.calls[0][0]).toContain("folder_id=fld_123");
  });

  it("stops paginating when a page returns fewer than count rows", async () => {
    mockFetchOnce({ campaigns: Array(2).fill({ id: "x", settings: { title: "x" } }) });
    await listRepTrainingCampaigns({ mode: "title", titleMatch: "" });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("caches the campaign list between calls with identical filter args", async () => {
    mockFetchOnce({ campaigns: [{ id: "a", settings: { title: "t" } }] });
    await listRepTrainingCampaigns({ mode: "title", titleMatch: "t" });
    const result2 = await listRepTrainingCampaigns({ mode: "title", titleMatch: "t" });
    expect(result2).toEqual([
      expect.objectContaining({ id: "a", title: "t" }),
    ]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("propagates upstream errors with status in the message", async () => {
    mockFetchOnce({ title: "Unauthorized" }, { status: 401 });
    await expect(listRepTrainingCampaigns({ mode: "title", titleMatch: "" })).rejects.toThrow(/401/);
  });
});

describe("getCampaignReport", () => {
  it("fetches /reports/{id} and caches the result", async () => {
    mockFetchOnce({ emails_sent: 100 });
    const first = await getCampaignReport("camp-42");
    const second = await getCampaignReport("camp-42");
    expect(first).toEqual({ emails_sent: 100 });
    expect(second).toEqual({ emails_sent: 100 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toContain("/reports/camp-42");
  });
});

describe("getCampaignClickDetails", () => {
  it("returns the urls_clicked array and caches it", async () => {
    mockFetchOnce({ urls_clicked: [{ url: "https://a", total_clicks: 3 }] });
    const first = await getCampaignClickDetails("c");
    const second = await getCampaignClickDetails("c");
    expect(first).toEqual([{ url: "https://a", total_clicks: 3 }]);
    expect(second).toBe(first);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toContain("/reports/c/click-details");
  });

  it("returns [] when urls_clicked is missing", async () => {
    mockFetchOnce({});
    await expect(getCampaignClickDetails("empty")).resolves.toEqual([]);
  });
});

describe("getCampaignEmailActivity", () => {
  it("paginates until a short page is returned", async () => {
    const full = { emails: Array(1000).fill({ email_address: "a@b", activity: [] }) };
    const short = { emails: [{ email_address: "last@b", activity: [] }] };
    mockFetchOnce(full);
    mockFetchOnce(short);
    const result = await getCampaignEmailActivity("c");
    expect(result).toHaveLength(1001);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[1][0]).toContain("offset=1000");
  });

  it("caches results per campaign id", async () => {
    mockFetchOnce({ emails: [{ email_address: "x", activity: [] }] });
    await getCampaignEmailActivity("same");
    await getCampaignEmailActivity("same");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("getListMemberProfiles", () => {
  it("resolves merge-field tags and maps members by email", async () => {
    mockFetchOnce({
      merge_fields: [
        { tag: "FNAME", name: "First Name" },
        { tag: "LNAME", name: "Last Name" },
        { tag: "COMPANY", name: "Company" },
      ],
    });
    mockFetchOnce({
      members: [
        { email_address: "A@EXAMPLE.COM", merge_fields: { FNAME: "Ana", LNAME: "Lee", COMPANY: "Acme" } },
      ],
    });
    const profiles = await getListMemberProfiles("list-1");
    expect(profiles.get("a@example.com")).toEqual({
      firstName: "Ana",
      lastName: "Lee",
      company: "Acme",
    });
  });

  it("falls back to keyword-matching when standard tags are absent", async () => {
    mockFetchOnce({
      merge_fields: [
        { tag: "F1", name: "First name" },
        { tag: "L1", name: "Last name" },
        { tag: "O1", name: "Organization" },
      ],
    });
    mockFetchOnce({
      members: [
        { email_address: "b@x", merge_fields: { F1: "Bo", L1: "Lu", O1: "OrgCo" } },
      ],
    });
    const profiles = await getListMemberProfiles("list-2");
    expect(profiles.get("b@x")).toEqual({ firstName: "Bo", lastName: "Lu", company: "OrgCo" });
  });

  it("stops paginating when a short page is returned", async () => {
    mockFetchOnce({ merge_fields: [{ tag: "FNAME", name: "First Name" }] });
    mockFetchOnce({ members: [{ email_address: "only@x", merge_fields: { FNAME: "Z" } }] });
    const profiles = await getListMemberProfiles("list-3");
    expect(profiles.size).toBe(1);
    // 1 merge-fields fetch + 1 members fetch (short page = stop)
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("getCampaignPollResults", () => {
  // Each test mocks: the click-details fetch, then one members fetch per
  // detected poll choice. We use fresh campaign IDs so the lib/cache doesn't
  // bleed results between tests.
  function pollLink(optionId, totalClicks = 1, linkId = `link-${optionId}`) {
    return {
      id: linkId,
      url: `https://mojavehvac.us18.list-manage.com/vote?u=xxx&id=yyy&POLL=217:${optionId}`,
      total_clicks: totalClicks,
      unique_clicks: totalClicks,
    };
  }

  it("returns null when the campaign has no clicked URLs", async () => {
    mockFetchOnce({ urls_clicked: [] });
    await expect(getCampaignPollResults("c-empty")).resolves.toBeNull();
  });

  it("returns null when no URL matches the POLL= pattern", async () => {
    mockFetchOnce({
      urls_clicked: [
        { id: "l1", url: "https://mojavehvac.com/products/arctidry", total_clicks: 5, unique_clicks: 5 },
      ],
    });
    await expect(getCampaignPollResults("c-no-poll")).resolves.toBeNull();
  });

  it("returns 'per-recipient' shape when members endpoint attributes clicks", async () => {
    mockFetchOnce({
      urls_clicked: [
        pollLink(1406, 2),
        pollLink(1407, 1),
      ],
    });
    // members fetch for each choice (in choices-ascending-option-id order)
    mockFetchOnce({ members: [{ email_address: "a@x", last_click: "2026-10-01T00:00:00Z" }, { email_address: "b@x", last_click: "2026-10-02T00:00:00Z" }] });
    mockFetchOnce({ members: [{ email_address: "c@x", last_click: "2026-10-03T00:00:00Z" }] });

    const result = await getCampaignPollResults("c-attributed");
    expect(result.shape).toBe("per-recipient");
    expect(result.pollId).toBe("217");
    expect(result.total).toBe(3);
    expect(result.responses.map((r) => r.Email)).toEqual(["c@x", "b@x", "a@x"]);
    expect(result.responses[0].Rating).toBe(2); // c@x voted option_id 1407 → rating 2
    expect(result.responses[2].Rating).toBe(1); // a@x voted option_id 1406 → rating 1
  });

  it("falls back to 'aggregate' shape when members endpoint returns empty", async () => {
    mockFetchOnce({
      urls_clicked: [
        pollLink(1406, 2),
        pollLink(1407, 3),
        pollLink(1408, 5),
      ],
    });
    // All member fetches empty (anonymous polls)
    mockFetchOnce({ members: [] });
    mockFetchOnce({ members: [] });
    mockFetchOnce({ members: [] });

    const result = await getCampaignPollResults("c-aggregate");
    expect(result.shape).toBe("aggregate");
    expect(result.totalVotes).toBe(10);
    expect(result.distribution).toEqual([
      { rating: 1, votes: 2 },
      { rating: 2, votes: 3 },
      { rating: 3, votes: 5 },
    ]);
    // weighted avg: (1*2 + 2*3 + 3*5) / 10 = 2.3
    expect(result.avgRating).toBeCloseTo(2.3);
  });

  it("picks the poll with the most options when a campaign has more than one", async () => {
    mockFetchOnce({
      urls_clicked: [
        { id: "a", url: "https://x.com/vote?POLL=100:1", total_clicks: 1, unique_clicks: 1 },
        { id: "b", url: "https://x.com/vote?POLL=100:2", total_clicks: 1, unique_clicks: 1 },
        { id: "c", url: "https://x.com/vote?POLL=217:1406", total_clicks: 1, unique_clicks: 1 },
        { id: "d", url: "https://x.com/vote?POLL=217:1407", total_clicks: 1, unique_clicks: 1 },
        { id: "e", url: "https://x.com/vote?POLL=217:1408", total_clicks: 1, unique_clicks: 1 },
      ],
    });
    // Three members fetches for poll 217 (3 choices) — all empty → aggregate
    mockFetchOnce({ members: [] });
    mockFetchOnce({ members: [] });
    mockFetchOnce({ members: [] });

    const result = await getCampaignPollResults("c-multi-poll");
    expect(result.pollId).toBe("217");
    expect(result.distribution).toHaveLength(3);
  });

  it("handles aggregate shape with zero votes gracefully", async () => {
    mockFetchOnce({
      urls_clicked: [pollLink(1406, 0), pollLink(1407, 0)],
    });
    mockFetchOnce({ members: [] });
    mockFetchOnce({ members: [] });

    const result = await getCampaignPollResults("c-no-votes");
    expect(result.shape).toBe("aggregate");
    expect(result.totalVotes).toBe(0);
    expect(result.avgRating).toBe(0);
  });
});
