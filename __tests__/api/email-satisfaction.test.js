/**
 * @jest-environment node
 */

jest.mock("../../lib/mailchimp", () => ({
  listMailchimpSurveys: jest.fn(),
  getMailchimpSurveyWithQuestions: jest.fn(),
  getMailchimpSurveyResponses: jest.fn(),
  getListMemberTags: jest.fn(),
}));

const mc = require("../../lib/mailchimp");
const { GET } = require("../../app/api/surveys/email-satisfaction/route");

function req(query = "") {
  return new Request(`http://localhost:3000/api/surveys/email-satisfaction${query ? "?" + query : ""}`);
}

function makeQuestion({ options = range0to10WithZeroCounts(), ...overrides } = {}) {
  return {
    id: "14206",
    survey_id: "s1",
    query: "Rate us 1-10",
    type: "range",
    total_responses: 0,
    is_required: true,
    options,
    ...overrides,
  };
}

function range0to10WithZeroCounts() {
  return Array.from({ length: 11 }, (_, i) => ({ id: String(i), label: String(i), count: 0 }));
}

describe("GET /api/surveys/email-satisfaction", () => {
  const originalError = console.error;
  beforeEach(() => {
    mc.listMailchimpSurveys.mockReset();
    mc.getMailchimpSurveyWithQuestions.mockReset();
    mc.getMailchimpSurveyResponses.mockReset();
    mc.getListMemberTags.mockReset();
    mc.getListMemberTags.mockResolvedValue(new Map());
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it("returns shape:'none' when no published surveys exist", async () => {
    mc.listMailchimpSurveys.mockResolvedValue([
      { id: "s1", title: "Draft", status: "draft" },
    ]);
    const res = await GET(req());
    const body = await res.json();
    expect(body.shape).toBe("none");
    expect(body.message).toMatch(/No published/);
    expect(mc.getMailchimpSurveyWithQuestions).not.toHaveBeenCalled();
  });

  it("picks the newest published survey by published_at", async () => {
    mc.listMailchimpSurveys.mockResolvedValue([
      { id: "old", title: "Old", status: "published", published_at: "2026-01-01T00:00:00Z" },
      { id: "new", title: "New", status: "published", published_at: "2026-10-01T00:00:00Z" },
      { id: "mid", title: "Mid", status: "published", published_at: "2026-05-01T00:00:00Z" },
    ]);
    mc.getMailchimpSurveyWithQuestions.mockResolvedValue({
      id: "new",
      title: "New",
      total_responses: 0,
      questions: [makeQuestion()],
    });
    await GET(req());
    expect(mc.getMailchimpSurveyWithQuestions).toHaveBeenCalledWith("new");
  });

  it("returns aggregate shape with zero counts when total_responses is 0", async () => {
    mc.listMailchimpSurveys.mockResolvedValue([
      { id: "s1", title: "Rating", status: "published", published_at: "2026-10-01T00:00:00Z" },
    ]);
    mc.getMailchimpSurveyWithQuestions.mockResolvedValue({
      id: "s1",
      title: "Rating",
      published_at: "2026-10-01T00:00:00Z",
      total_responses: 0,
      questions: [makeQuestion()],
    });
    const res = await GET(req());
    const body = await res.json();
    expect(body.shape).toBe("aggregate");
    expect(body.totalVotes).toBe(0);
    expect(body.avgRating).toBe(0);
    // Should drop the 0-rating option, keeping 1..10
    expect(body.distribution).toHaveLength(10);
    expect(body.distribution[0].rating).toBe(1);
    expect(body.distribution[9].rating).toBe(10);
    expect(mc.getMailchimpSurveyResponses).not.toHaveBeenCalled();
  });

  it("returns per-recipient shape when responses carry contact info", async () => {
    mc.listMailchimpSurveys.mockResolvedValue([
      { id: "s1", title: "Rating", status: "published", published_at: "2026-10-01T00:00:00Z" },
    ]);
    mc.getMailchimpSurveyWithQuestions.mockResolvedValue({
      id: "s1",
      title: "Rating",
      list_id: "list-1",
      total_responses: 2,
      questions: [makeQuestion({ id: "q1" })],
    });
    mc.getMailchimpSurveyResponses.mockResolvedValue([
      { id: "r1", contact: { email_address: "a@x.com" }, submitted_at: "2026-10-05T00:00:00Z", answers: [{ question_id: "q1", value: "9" }] },
      { id: "r2", contact: { email_address: "b@x.com" }, submitted_at: "2026-10-06T00:00:00Z", answers: [{ question_id: "q1", value: "4" }] },
    ]);
    const res = await GET(req());
    const body = await res.json();
    expect(body.shape).toBe("per-recipient");
    expect(body.total).toBe(2);
    // sorted newest-first
    expect(body.responses[0].Email).toBe("b@x.com");
    expect(body.responses[0].Rating).toBe(4);
    expect(body.responses[1].Email).toBe("a@x.com");
    expect(body.responses[1].Rating).toBe(9);
  });

  it("enriches responses with Tags and emits byTag aggregation", async () => {
    mc.listMailchimpSurveys.mockResolvedValue([
      { id: "s1", title: "Rating", status: "published", published_at: "2026-10-01T00:00:00Z" },
    ]);
    mc.getMailchimpSurveyWithQuestions.mockResolvedValue({
      id: "s1",
      title: "Rating",
      list_id: "list-1",
      total_responses: 3,
      questions: [makeQuestion({ id: "q1" })],
    });
    mc.getMailchimpSurveyResponses.mockResolvedValue([
      { id: "r1", contact: { email_address: "A@x.com" }, submitted_at: "2026-10-01", answers: [{ question_id: "q1", value: "9" }] },
      { id: "r2", contact: { email_address: "b@x.com" }, submitted_at: "2026-10-02", answers: [{ question_id: "q1", value: "7" }] },
      { id: "r3", contact: { email_address: "c@x.com" }, submitted_at: "2026-10-03", answers: [{ question_id: "q1", value: "3" }] },
    ]);
    mc.getListMemberTags.mockResolvedValue(new Map([
      ["a@x.com", ["VIP", "Contractor"]],
      ["b@x.com", ["Contractor"]],
      // c@x.com not in the map
    ]));

    const res = await GET(req());
    const body = await res.json();
    expect(body.responses.find((r) => r.Email === "A@x.com").Tags).toEqual(["VIP", "Contractor"]);
    expect(body.responses.find((r) => r.Email === "c@x.com").Tags).toEqual([]);

    const byTag = Object.fromEntries(body.byTag.map((g) => [g.tag, g]));
    // Contractor: a (9) + b (7) = avg 8, 2 votes
    expect(byTag["Contractor"].votes).toBe(2);
    expect(byTag["Contractor"].avg).toBeCloseTo(8);
    // VIP: a (9) only = avg 9, 1 vote
    expect(byTag["VIP"].votes).toBe(1);
    expect(byTag["VIP"].avg).toBe(9);
    // c had no tags → "(no tag)"
    expect(byTag["(no tag)"].votes).toBe(1);
    expect(byTag["(no tag)"].avg).toBe(3);
    // Sorted by votes desc
    expect(body.byTag[0].tag).toBe("Contractor");
  });

  it("still returns per-recipient when the tags lookup fails", async () => {
    mc.listMailchimpSurveys.mockResolvedValue([
      { id: "s1", title: "Rating", status: "published", published_at: "2026-10-01T00:00:00Z" },
    ]);
    mc.getMailchimpSurveyWithQuestions.mockResolvedValue({
      id: "s1",
      title: "Rating",
      list_id: "list-1",
      total_responses: 1,
      questions: [makeQuestion({ id: "q1" })],
    });
    mc.getMailchimpSurveyResponses.mockResolvedValue([
      { id: "r1", contact: { email_address: "a@x" }, submitted_at: "2026-10-01", answers: [{ question_id: "q1", value: "5" }] },
    ]);
    mc.getListMemberTags.mockRejectedValue(new Error("tags fetch failed"));

    const res = await GET(req());
    const body = await res.json();
    expect(body.shape).toBe("per-recipient");
    expect(body.responses[0].Tags).toEqual([]);
    expect(body.byTag).toEqual([{ tag: "(no tag)", votes: 1, avg: 5 }]);
  });

  it("falls back to aggregate when total_responses>0 but no per-recipient rows resolve", async () => {
    mc.listMailchimpSurveys.mockResolvedValue([
      { id: "s1", title: "Rating", status: "published", published_at: "2026-10-01T00:00:00Z" },
    ]);
    mc.getMailchimpSurveyWithQuestions.mockResolvedValue({
      id: "s1",
      title: "Rating",
      total_responses: 3,
      questions: [makeQuestion({
        id: "q1",
        options: [
          { id: "0", label: "0", count: 0 },
          { id: "7", label: "7", count: 2 },
          { id: "9", label: "9", count: 1 },
        ],
      })],
    });
    // Response rows exist but answers don't reference q1 (anonymous survey case)
    mc.getMailchimpSurveyResponses.mockResolvedValue([
      { id: "r1", answers: [{ question_id: "other", value: "yes" }] },
    ]);
    const res = await GET(req());
    const body = await res.json();
    expect(body.shape).toBe("aggregate");
    expect(body.totalVotes).toBe(3);
    expect(body.avgRating).toBeCloseTo((7 * 2 + 9 * 1) / 3);
  });

  it("respects the surveyId query param", async () => {
    mc.getMailchimpSurveyWithQuestions.mockResolvedValue({
      id: "custom",
      title: "Custom",
      total_responses: 0,
      questions: [makeQuestion()],
    });
    await GET(req("surveyId=custom"));
    expect(mc.listMailchimpSurveys).not.toHaveBeenCalled();
    expect(mc.getMailchimpSurveyWithQuestions).toHaveBeenCalledWith("custom");
  });

  it("returns shape:'none' when the chosen survey has no questions", async () => {
    mc.listMailchimpSurveys.mockResolvedValue([
      { id: "s1", title: "Empty", status: "published", published_at: "2026-10-01" },
    ]);
    mc.getMailchimpSurveyWithQuestions.mockResolvedValue({
      id: "s1",
      title: "Empty",
      total_responses: 0,
      questions: [],
    });
    const res = await GET(req());
    const body = await res.json();
    expect(body.shape).toBe("none");
    expect(body.message).toMatch(/no questions/i);
  });

  it("returns 500 when the lib throws", async () => {
    mc.listMailchimpSurveys.mockRejectedValue(new Error("mailchimp down"));
    const res = await GET(req());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/mailchimp down/);
  });

  describe("edge-case normalization", () => {
    const basics = {
      id: "s1",
      title: "Rating",
      total_responses: 1,
      published_at: "2026-10-01T00:00:00Z",
    };

    it("skips response rows that lack an answer for the chosen question", async () => {
      mc.getMailchimpSurveyWithQuestions.mockResolvedValue({
        ...basics,
        questions: [makeQuestion({ id: "q1" })],
      });
      mc.getMailchimpSurveyResponses.mockResolvedValue([
        { id: "r1", contact: { email_address: "a@x" }, submitted_at: "2026-10-01", answers: [] },
        { id: "r2", contact: { email_address: "b@x" }, submitted_at: "2026-10-02" }, // no `answers` key
      ]);
      const res = await GET(req("surveyId=s1"));
      const body = await res.json();
      // Both rows get skipped (no matching answers), so we fall back to aggregate.
      expect(body.shape).toBe("aggregate");
    });

    it("skips rows where the answer value is non-numeric", async () => {
      mc.getMailchimpSurveyWithQuestions.mockResolvedValue({
        ...basics,
        questions: [makeQuestion({ id: "q1" })],
      });
      mc.getMailchimpSurveyResponses.mockResolvedValue([
        { id: "r1", contact: { email_address: "a@x" }, submitted_at: "2026-10-01", answers: [{ question_id: "q1", value: "not a number" }] },
      ]);
      const res = await GET(req("surveyId=s1"));
      const body = await res.json();
      expect(body.shape).toBe("aggregate");
    });

    it("falls back to full_name then 'Anonymous' when email is missing", async () => {
      mc.getMailchimpSurveyWithQuestions.mockResolvedValue({
        ...basics,
        total_responses: 2,
        questions: [makeQuestion({ id: "q1" })],
      });
      mc.getMailchimpSurveyResponses.mockResolvedValue([
        { id: "r1", contact: { full_name: "Named Person" }, submitted_at: "2026-10-01", answers: [{ question_id: "q1", value: "7" }] },
        { id: "r2", contact: {}, submitted_at: "2026-10-02", answers: [{ question_id: "q1", value: "5" }] },
      ]);
      const res = await GET(req("surveyId=s1"));
      const body = await res.json();
      expect(body.responses.map((r) => r.Email).sort()).toEqual(["Anonymous", "Named Person"]);
    });

    it("drops options whose label is non-numeric or outside 1-10 (defensive)", async () => {
      mc.getMailchimpSurveyWithQuestions.mockResolvedValue({
        ...basics,
        total_responses: 0,
        questions: [makeQuestion({
          options: [
            { id: "x", label: "not a number", count: 5 },
            { id: "0", label: "0", count: 3 },
            { id: "5", label: "5", count: 2 },
            { id: "11", label: "11", count: 1 },
            // Option without count — should default to 0
            { id: "7", label: "7" },
          ],
        })],
      });
      const res = await GET(req("surveyId=s1"));
      const body = await res.json();
      // Only ratings 5 and 7 are in 1..10 range
      expect(body.distribution.map((d) => d.rating)).toEqual([5, 7]);
      expect(body.distribution[0].votes).toBe(2);
      expect(body.distribution[1].votes).toBe(0);
    });

    it("handles a question with no options array (returns empty distribution)", async () => {
      mc.getMailchimpSurveyWithQuestions.mockResolvedValue({
        ...basics,
        total_responses: 0,
        questions: [{ id: "q1", query: "?", type: "range" }],
      });
      const res = await GET(req("surveyId=s1"));
      const body = await res.json();
      expect(body.shape).toBe("aggregate");
      expect(body.distribution).toEqual([]);
    });
  });
});
