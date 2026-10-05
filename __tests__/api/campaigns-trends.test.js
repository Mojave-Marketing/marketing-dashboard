/**
 * @jest-environment node
 */

jest.mock("../../lib/mailchimp", () => ({
  listRepTrainingCampaigns: jest.fn(),
  getCampaignReport: jest.fn(),
}));

const mc = require("../../lib/mailchimp");
const { GET, _internals } = require("../../app/api/campaigns/trends/route");
const { generateTrendTakeaways } = _internals;

const benchmarks = { openRate: 0.26, clickRate: 0.03 };

function makeSend(overrides = {}) {
  return {
    id: overrides.id || "s",
    title: overrides.title || "Send",
    sendTime: overrides.sendTime || "2026-01-01T00:00:00Z",
    sent: 100,
    uniqueOpens: 30,
    uniqueClicks: 10,
    openRate: 0.3,
    clickRate: 0.1,
    clickToOpenRate: 0.33,
    ...overrides,
  };
}

describe("generateTrendTakeaways", () => {
  it("returns [] when there are fewer than 2 sends", () => {
    expect(generateTrendTakeaways([makeSend()], benchmarks)).toEqual([]);
    expect(generateTrendTakeaways([], benchmarks)).toEqual([]);
  });

  it("compares last-3 vs first-3 open rate only when n >= 6", () => {
    const few = Array.from({ length: 5 }, (_, i) => makeSend({ id: `s${i}`, openRate: 0.2 + i * 0.01 }));
    expect(generateTrendTakeaways(few, benchmarks).some((t) => t.title === "Open rate momentum")).toBe(false);

    const many = Array.from({ length: 6 }, (_, i) =>
      makeSend({ id: `s${i}`, openRate: i < 3 ? 0.2 : 0.3 })
    );
    const trends = generateTrendTakeaways(many, benchmarks);
    const momentum = trends.find((t) => t.title === "Open rate momentum");
    expect(momentum).toBeDefined();
    expect(momentum.body).toMatch(/climbed/);
  });

  it("reports declining momentum when recent sends underperform", () => {
    const sends = Array.from({ length: 6 }, (_, i) =>
      makeSend({ id: `s${i}`, openRate: i < 3 ? 0.4 : 0.2 })
    );
    const trends = generateTrendTakeaways(sends, benchmarks);
    const momentum = trends.find((t) => t.title === "Open rate momentum");
    expect(momentum.body).toMatch(/declined/);
  });

  it("surfaces best vs worst send by open rate", () => {
    const sends = [
      makeSend({ id: "lo", title: "Dud", openRate: 0.1 }),
      makeSend({ id: "mid", title: "Mid", openRate: 0.2 }),
      makeSend({ id: "hi", title: "Winner", openRate: 0.4 }),
    ];
    const trends = generateTrendTakeaways(sends, benchmarks);
    const bestWorst = trends.find((t) => t.title === "Best vs. worst send");
    expect(bestWorst.body).toMatch(/Winner/);
    expect(bestWorst.body).toMatch(/Dud/);
  });

  it("includes benchmark hit rate for both open and click", () => {
    const sends = [
      makeSend({ id: "a", openRate: 0.3, clickRate: 0.04 }),
      makeSend({ id: "b", openRate: 0.1, clickRate: 0.01 }),
    ];
    const trends = generateTrendTakeaways(sends, benchmarks);
    const bench = trends.find((t) => t.title === "Benchmark hit rate");
    expect(bench.body).toMatch(/1.*exceeded/);
    expect(bench.body).toMatch(/1.*cleared/);
  });
});

describe("GET /api/campaigns/trends", () => {
  const originalError = console.error;
  beforeEach(() => {
    mc.listRepTrainingCampaigns.mockReset();
    mc.getCampaignReport.mockReset();
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it("returns sends sorted ascending by sendTime with rolling averages after 3 points", async () => {
    mc.listRepTrainingCampaigns.mockResolvedValue([
      { id: "c3", title: "Three", sendTime: "2026-03-01T00:00:00Z" },
      { id: "c1", title: "One", sendTime: "2026-01-01T00:00:00Z" },
      { id: "c2", title: "Two", sendTime: "2026-02-01T00:00:00Z" },
    ]);
    mc.getCampaignReport.mockImplementation((id) => {
      const map = {
        c1: { emails_sent: 100, opens: { open_rate: 0.1, unique_opens: 10 }, clicks: { click_rate: 0.01, unique_clicks: 1 } },
        c2: { emails_sent: 100, opens: { open_rate: 0.2, unique_opens: 20 }, clicks: { click_rate: 0.02, unique_clicks: 2 } },
        c3: { emails_sent: 100, opens: { open_rate: 0.3, unique_opens: 30 }, clicks: { click_rate: 0.03, unique_clicks: 3 } },
      };
      return Promise.resolve(map[id]);
    });

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.sends.map((s) => s.id)).toEqual(["c1", "c2", "c3"]);
    expect(body.sends[0].rollingOpenRate).toBeNull();
    expect(body.sends[1].rollingOpenRate).toBeNull();
    expect(body.sends[2].rollingOpenRate).toBeCloseTo((0.1 + 0.2 + 0.3) / 3);
    expect(body.benchmarks).toEqual({ openRate: 0.26, clickRate: 0.03 });
    expect(body.total).toBe(3);
  });

  it("drops campaigns whose report fetch failed", async () => {
    mc.listRepTrainingCampaigns.mockResolvedValue([
      { id: "ok", title: "Ok", sendTime: "2026-01-01T00:00:00Z" },
      { id: "bad", title: "Bad", sendTime: "2026-02-01T00:00:00Z" },
    ]);
    mc.getCampaignReport.mockImplementation((id) =>
      id === "bad"
        ? Promise.reject(new Error("report fail"))
        : Promise.resolve({ emails_sent: 10, opens: { open_rate: 0.1, unique_opens: 1 }, clicks: { click_rate: 0, unique_clicks: 0 } })
    );
    const res = await GET();
    const body = await res.json();
    expect(body.sends.map((s) => s.id)).toEqual(["ok"]);
  });

  it("returns 500 when the campaign list fetch fails", async () => {
    mc.listRepTrainingCampaigns.mockRejectedValue(new Error("list broke"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
