/**
 * @jest-environment node
 */

jest.mock("../../lib/mailchimp", () => ({
  listRepTrainingCampaigns: jest.fn(),
}));

const { listRepTrainingCampaigns } = require("../../lib/mailchimp");
const { GET } = require("../../app/api/campaigns/route");

describe("GET /api/campaigns", () => {
  const originalError = console.error;
  beforeEach(() => {
    listRepTrainingCampaigns.mockReset();
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it("returns the campaign list from the mailchimp lib", async () => {
    listRepTrainingCampaigns.mockResolvedValue([{ id: "a", title: "A" }]);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.campaigns).toEqual([{ id: "a", title: "A" }]);
  });

  it("returns 500 with the error message when the lib throws", async () => {
    listRepTrainingCampaigns.mockRejectedValue(new Error("upstream broke"));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/upstream broke/);
  });
});
