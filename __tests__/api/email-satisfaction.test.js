/**
 * @jest-environment node
 */

jest.mock("../../lib/mailchimp", () => ({
  listRepTrainingCampaigns: jest.fn(),
  getCampaignPollResults: jest.fn(),
}));

const mc = require("../../lib/mailchimp");
const { GET } = require("../../app/api/surveys/email-satisfaction/route");

function req(query = "") {
  return new Request(`http://localhost:3000/api/surveys/email-satisfaction${query ? "?" + query : ""}`);
}

describe("GET /api/surveys/email-satisfaction", () => {
  const originalError = console.error;
  beforeEach(() => {
    mc.listRepTrainingCampaigns.mockReset();
    mc.getCampaignPollResults.mockReset();
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it("returns shape:'none' when no recent campaign has a poll", async () => {
    mc.listRepTrainingCampaigns.mockResolvedValue([
      { id: "c1", title: "A", sendTime: "2026-10-01T00:00:00Z" },
      { id: "c2", title: "B", sendTime: "2026-09-01T00:00:00Z" },
    ]);
    mc.getCampaignPollResults.mockResolvedValue(null);
    const res = await GET(req());
    const body = await res.json();
    expect(body.shape).toBe("none");
    expect(body.scanned).toBe(2);
  });

  it("returns the first campaign with a poll when scanning recent campaigns", async () => {
    mc.listRepTrainingCampaigns.mockResolvedValue([
      { id: "newest", title: "New", sendTime: "2026-10-05T00:00:00Z" },
      { id: "has-poll", title: "Satisfaction", sendTime: "2026-09-01T00:00:00Z" },
    ]);
    mc.getCampaignPollResults
      .mockResolvedValueOnce(null) // newest has no poll
      .mockResolvedValueOnce({
        shape: "aggregate",
        pollId: "217",
        distribution: [{ rating: 1, votes: 3 }],
        totalVotes: 3,
        avgRating: 1,
      });
    const res = await GET(req());
    const body = await res.json();
    expect(body.shape).toBe("aggregate");
    expect(body.pollId).toBe("217");
    expect(body.campaign.title).toBe("Satisfaction");
  });

  it("respects the campaignId query param", async () => {
    mc.listRepTrainingCampaigns.mockResolvedValue([
      { id: "c1", title: "One", sendTime: "2026-10-01T00:00:00Z" },
      { id: "c2", title: "Two", sendTime: "2026-09-01T00:00:00Z" },
    ]);
    mc.getCampaignPollResults.mockResolvedValue({
      shape: "per-recipient",
      pollId: "999",
      responses: [{ Email: "a@x", Rating: 10, _receivedAt: "2026-10-01" }],
      total: 1,
    });
    const res = await GET(req("campaignId=c2"));
    const body = await res.json();
    expect(mc.getCampaignPollResults).toHaveBeenCalledWith("c2");
    expect(body.shape).toBe("per-recipient");
    expect(body.campaign.title).toBe("Two");
  });

  it("returns shape:'none' with the campaign when the specified campaign has no poll", async () => {
    mc.listRepTrainingCampaigns.mockResolvedValue([
      { id: "c-dry", title: "Dry", sendTime: "2026-10-01T00:00:00Z" },
    ]);
    mc.getCampaignPollResults.mockResolvedValue(null);
    const res = await GET(req("campaignId=c-dry"));
    const body = await res.json();
    expect(body.shape).toBe("none");
    expect(body.campaign.id).toBe("c-dry");
  });

  it("returns 500 when the lib throws", async () => {
    mc.listRepTrainingCampaigns.mockRejectedValue(new Error("mailchimp down"));
    const res = await GET(req());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/mailchimp down/);
  });
});
