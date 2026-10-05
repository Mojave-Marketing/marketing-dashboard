/**
 * @jest-environment node
 */

jest.mock("../../lib/mailchimp", () => ({
  getCampaignReport: jest.fn(),
  getCampaignClickDetails: jest.fn(),
  getCampaignEmailActivity: jest.fn(),
}));

const mailchimp = require("../../lib/mailchimp");
const { GET, _internals } = require("../../app/api/campaigns/[id]/route");
const { bucketOpens, buildContactList, findHighOpenNoClick, generateTakeaways } = _internals;

function activity(opens, clicks, email = "x@y.com", baseTime = "2026-09-01T00:00:00Z") {
  const acts = [];
  for (let i = 0; i < opens; i++) acts.push({ action: "open", timestamp: baseTime });
  for (let i = 0; i < clicks; i++) acts.push({ action: "click", timestamp: baseTime });
  return { email_address: email, activity: acts };
}

describe("bucketOpens", () => {
  it("partitions by open count across all buckets", () => {
    const members = [
      activity(0, 0),
      activity(1, 0),
      activity(2, 0),
      activity(3, 0),
      activity(4, 0),
      activity(5, 0),
      activity(6, 0),
      activity(10, 0),
      activity(11, 0),
      activity(100, 0),
    ];
    const result = bucketOpens(members);
    const byBucket = Object.fromEntries(result.map((r) => [r.bucket, r.count]));
    expect(byBucket).toEqual({ "0": 1, "1": 1, "2": 1, "3": 1, "4-5": 2, "6-10": 2, "11+": 2 });
  });

  it("returns all buckets even when input is empty", () => {
    const result = bucketOpens([]);
    expect(result).toHaveLength(7);
    expect(result.every((r) => r.count === 0)).toBe(true);
  });
});

describe("buildContactList", () => {
  it("filters out members with zero activity and sorts by opens then clicks desc", () => {
    const members = [
      activity(0, 0, "none@x"),
      activity(5, 1, "mid@x"),
      activity(10, 2, "top@x"),
      activity(5, 3, "clicky@x"),
    ];
    const list = buildContactList(members);
    expect(list.map((c) => c.email)).toEqual(["top@x", "clicky@x", "mid@x"]);
  });

  it("captures lastActive as the latest timestamp across all actions", () => {
    const member = {
      email_address: "a@b.c",
      activity: [
        { action: "open", timestamp: "2026-01-01T00:00:00Z" },
        { action: "click", timestamp: "2026-09-01T00:00:00Z" },
        { action: "open", timestamp: "2026-05-01T00:00:00Z" },
      ],
    };
    const [row] = buildContactList([member]);
    expect(row.lastActive).toBe("2026-09-01T00:00:00Z");
  });
});

describe("findHighOpenNoClick", () => {
  it("returns members with >=5 opens and 0 clicks", () => {
    const members = [
      activity(5, 0, "a@x"),
      activity(6, 1, "b@x"),
      activity(4, 0, "c@x"),
      activity(20, 0, "d@x"),
    ];
    const result = findHighOpenNoClick(members);
    expect(result.map((m) => m.email_address)).toEqual(["a@x", "d@x"]);
  });

  it("honors a custom minOpens threshold", () => {
    const result = findHighOpenNoClick([activity(3, 0, "a@x")], 3);
    expect(result).toHaveLength(1);
  });
});

describe("generateTakeaways", () => {
  const baseReport = {
    emails_sent: 100,
    opens: { open_rate: 0.3, unique_opens: 30 },
    clicks: { click_rate: 0.05, unique_clicks: 10 },
  };

  it("emits above-benchmark language when open rate beats the benchmark", () => {
    const takeaways = generateTakeaways({
      report: baseReport,
      engagementBuckets: bucketOpens([]),
      topLinks: [],
      highOpenNoClick: [],
      emailActivity: [],
    });
    const openCard = takeaways.find((t) => t.title.includes("Open rate"));
    expect(openCard.body).toMatch(/above/);
  });

  it("emits below-benchmark language when open rate trails the benchmark", () => {
    const takeaways = generateTakeaways({
      report: { ...baseReport, opens: { open_rate: 0.1, unique_opens: 10 } },
      engagementBuckets: bucketOpens([]),
      topLinks: [],
      highOpenNoClick: [],
      emailActivity: [],
    });
    const openCard = takeaways.find((t) => t.title.includes("Open rate"));
    expect(openCard.body).toMatch(/below/);
  });

  it("adds a 'high-opens, zero-clicks' takeaway when that cohort exists", () => {
    const takeaways = generateTakeaways({
      report: baseReport,
      engagementBuckets: bucketOpens([]),
      topLinks: [],
      highOpenNoClick: [activity(6, 0)],
      emailActivity: [],
    });
    expect(takeaways.some((t) => t.title.includes("Engaged but not converting"))).toBe(true);
  });

  it("highlights dead links when some top links got zero clicks", () => {
    const takeaways = generateTakeaways({
      report: baseReport,
      engagementBuckets: bucketOpens([]),
      topLinks: [
        { url: "https://a", total_clicks: 50 },
        { url: "https://b", total_clicks: 0 },
      ],
      highOpenNoClick: [],
      emailActivity: [],
    });
    const linksCard = takeaways.find((t) => t.title === "Where the clicks went");
    expect(linksCard.body).toMatch(/zero clicks/);
  });
});

describe("GET /api/campaigns/[id]", () => {
  const originalError = console.error;
  beforeEach(() => {
    mailchimp.getCampaignReport.mockReset();
    mailchimp.getCampaignClickDetails.mockReset();
    mailchimp.getCampaignEmailActivity.mockReset();
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it("returns KPIs, funnel, buckets, top links, takeaways, contacts", async () => {
    mailchimp.getCampaignReport.mockResolvedValue({
      settings: { title: "Weekly" },
      send_time: "2026-09-01T00:00:00Z",
      emails_sent: 100,
      bounces: { hard_bounces: 1, soft_bounces: 2, syntax_errors: 0 },
      opens: { open_rate: 0.3, unique_opens: 30 },
      clicks: { click_rate: 0.05, unique_clicks: 10 },
      unsubscribes: 1,
    });
    mailchimp.getCampaignClickDetails.mockResolvedValue([
      { url: "https://a", total_clicks: 20, unique_clicks: 15 },
      { url: "https://b", total_clicks: 5, unique_clicks: 3 },
    ]);
    mailchimp.getCampaignEmailActivity.mockResolvedValue([activity(2, 1, "a@x")]);

    const res = await GET(new Request("http://localhost/api/campaigns/c1"), { params: { id: "c1" } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.title).toBe("Weekly");
    expect(body.kpis.sent).toBe(100);
    expect(body.kpis.delivered).toBe(97);
    expect(body.kpis.benchmarks).toEqual({ openRate: 0.26, clickRate: 0.03 });
    expect(body.funnel).toEqual([
      { stage: "Sent", value: 100 },
      { stage: "Delivered", value: 97 },
      { stage: "Opened", value: 30 },
      { stage: "Clicked", value: 10 },
    ]);
    expect(body.topLinks[0]).toEqual({ url: "https://a", clicks: 20, uniqueClicks: 15 });
    expect(body.contacts).toHaveLength(1);
    expect(body.takeaways.length).toBeGreaterThan(0);
    expect(body.recipientCountFromActivity).toBe(1);
  });

  it("returns 500 when getCampaignReport throws", async () => {
    mailchimp.getCampaignReport.mockRejectedValue(new Error("mailchimp down"));
    mailchimp.getCampaignClickDetails.mockResolvedValue([]);
    mailchimp.getCampaignEmailActivity.mockResolvedValue([]);
    const res = await GET(new Request("http://localhost/api/campaigns/x"), { params: { id: "x" } });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/mailchimp down/);
  });
});
