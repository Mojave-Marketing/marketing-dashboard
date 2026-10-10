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
let listMailchimpSurveys;
let getMailchimpSurveyWithQuestions;
let getMailchimpSurveyResponses;

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
  listMailchimpSurveys = mod.listMailchimpSurveys;
  getMailchimpSurveyWithQuestions = mod.getMailchimpSurveyWithQuestions;
  getMailchimpSurveyResponses = mod.getMailchimpSurveyResponses;

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

describe("listMailchimpSurveys", () => {
  it("returns the surveys array from /reporting/surveys", async () => {
    mockFetchOnce({
      surveys: [
        { id: "s1", title: "Contractor Rating", status: "published", total_responses: 0 },
        { id: "s2", title: "Owner Rating", status: "draft", total_responses: 0 },
      ],
      total_items: 2,
    });
    const surveys = await listMailchimpSurveys();
    expect(surveys).toHaveLength(2);
    expect(surveys[0].id).toBe("s1");
    expect(global.fetch.mock.calls[0][0]).toContain("/reporting/surveys");
  });

  it("caches the result", async () => {
    mockFetchOnce({ surveys: [{ id: "s1" }] });
    await listMailchimpSurveys();
    await listMailchimpSurveys();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns [] when surveys field is missing", async () => {
    mockFetchOnce({});
    await expect(listMailchimpSurveys()).resolves.toEqual([]);
  });
});

describe("getMailchimpSurveyWithQuestions", () => {
  it("combines metadata + questions into one object", async () => {
    mockFetchOnce({ id: "s1", title: "Rating", total_responses: 5 });
    mockFetchOnce({
      questions: [{ id: "q1", query: "Rate us", type: "range" }],
      total_items: 1,
    });
    const result = await getMailchimpSurveyWithQuestions("s1");
    expect(result.id).toBe("s1");
    expect(result.title).toBe("Rating");
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].query).toBe("Rate us");
  });

  it("defaults questions to [] when the endpoint omits them", async () => {
    mockFetchOnce({ id: "s1", title: "Rating" });
    mockFetchOnce({});
    const result = await getMailchimpSurveyWithQuestions("s1");
    expect(result.questions).toEqual([]);
  });

  it("caches by survey id", async () => {
    mockFetchOnce({ id: "s2" });
    mockFetchOnce({ questions: [] });
    await getMailchimpSurveyWithQuestions("s2");
    await getMailchimpSurveyWithQuestions("s2");
    // 2 fetches for first call (survey + questions), 0 for second (cached)
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("getMailchimpSurveyResponses", () => {
  it("returns the responses array", async () => {
    mockFetchOnce({
      responses: [
        { id: "r1", contact: { email_address: "a@x" }, submitted_at: "2026-10-01T00:00:00Z", answers: [{ question_id: "q1", value: "9" }] },
      ],
      total_items: 1,
    });
    const result = await getMailchimpSurveyResponses("s1");
    expect(result).toHaveLength(1);
    expect(result[0].contact.email_address).toBe("a@x");
  });

  it("paginates until a short page is returned", async () => {
    mockFetchOnce({ responses: Array(1000).fill({ id: "r" }) });
    mockFetchOnce({ responses: [{ id: "last" }] });
    const result = await getMailchimpSurveyResponses("s-many");
    expect(result).toHaveLength(1001);
    expect(global.fetch.mock.calls[1][0]).toContain("offset=1000");
  });

  it("returns [] when no responses yet", async () => {
    mockFetchOnce({ responses: [], total_items: 0 });
    await expect(getMailchimpSurveyResponses("s-empty")).resolves.toEqual([]);
  });

  it("caches by survey id", async () => {
    mockFetchOnce({ responses: [{ id: "r1" }] });
    await getMailchimpSurveyResponses("s-cache");
    await getMailchimpSurveyResponses("s-cache");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
