import { render, screen, waitFor } from "@testing-library/react";
import EmailSatisfactionView from "../../components/EmailSatisfactionView";

const originalFetch = global.fetch;

function mockApi(body, { ok = true } = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  });
}

describe("EmailSatisfactionView", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("shows loading state until fetch resolves", async () => {
    let resolve;
    global.fetch = jest.fn().mockImplementation(() => new Promise((r) => (resolve = r)));
    render(<EmailSatisfactionView />);
    expect(screen.getByText(/Loading poll results/)).toBeInTheDocument();
    resolve({
      ok: true,
      json: () => Promise.resolve({ shape: "none", message: "nope" }),
    });
    await waitFor(() => expect(screen.queryByText(/Loading/)).not.toBeInTheDocument());
  });

  it("renders error state when API returns an error", async () => {
    mockApi({ error: "mailchimp 500" });
    render(<EmailSatisfactionView />);
    await waitFor(() => expect(screen.getByText(/mailchimp 500/)).toBeInTheDocument());
  });

  it("renders empty state with the server-provided message when shape is 'none'", async () => {
    mockApi({ shape: "none", message: "No published Mailchimp surveys found." });
    render(<EmailSatisfactionView />);
    await waitFor(() => expect(screen.getByText(/No survey results yet/)).toBeInTheDocument());
    expect(screen.getByText(/No published Mailchimp surveys found/)).toBeInTheDocument();
  });

  it("renders the per-recipient table when shape is 'per-recipient'", async () => {
    mockApi({
      shape: "per-recipient",
      total: 2,
      responses: [
        { Email: "a@x.com", Rating: 9, Tags: [], _receivedAt: "2026-10-01T00:00:00Z" },
        { Email: "b@x.com", Rating: 4, Tags: [], _receivedAt: "2026-09-01T00:00:00Z" },
      ],
      byTag: [],
      survey: { id: "s1", title: "Contractor Rating Survey", publishedAt: "2026-10-01T00:00:00Z" },
      question: { id: "q1", query: "Rate your experience 1-10", type: "range" },
    });
    render(<EmailSatisfactionView />);
    await waitFor(() => expect(screen.getByText("a@x.com")).toBeInTheDocument());
    expect(screen.getByText("b@x.com")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Contractor Rating Survey")).toBeInTheDocument();
    expect(screen.getByText(/Rate your experience 1-10/)).toBeInTheDocument();
    expect(screen.getByText(/Avg Score \(out of 10\)/)).toBeInTheDocument();
    expect(screen.getByText("6.5")).toBeInTheDocument(); // (9 + 4) / 2
  });

  it("shows Tags column and Breakdown-by-tag card when responses carry tags", async () => {
    mockApi({
      shape: "per-recipient",
      total: 3,
      responses: [
        { Email: "a@x.com", Rating: 9, Tags: ["VIP", "Contractor"], _receivedAt: "2026-10-03" },
        { Email: "b@x.com", Rating: 7, Tags: ["Contractor"], _receivedAt: "2026-10-02" },
        { Email: "c@x.com", Rating: 3, Tags: [], _receivedAt: "2026-10-01" },
      ],
      byTag: [
        { tag: "Contractor", votes: 2, avg: 8 },
        { tag: "VIP", votes: 1, avg: 9 },
        { tag: "(no tag)", votes: 1, avg: 3 },
      ],
      survey: { id: "s1", title: "Rating", publishedAt: "2026-10-01" },
      question: { id: "q1", query: "Rate us", type: "range" },
    });
    render(<EmailSatisfactionView />);
    await waitFor(() => expect(screen.getByText(/Breakdown by tag/)).toBeInTheDocument());
    expect(screen.getByText("VIP, Contractor")).toBeInTheDocument();
    expect(screen.getAllByText("Contractor").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("(no tag)")).toBeInTheDocument();
    // Avg values rendered to one decimal
    expect(screen.getByText("8.0")).toBeInTheDocument(); // Contractor avg
    expect(screen.getByText("9.0")).toBeInTheDocument(); // VIP avg
  });

  it("omits the Tags column entirely when no response has tags", async () => {
    mockApi({
      shape: "per-recipient",
      total: 1,
      responses: [{ Email: "a@x.com", Rating: 7, Tags: [], _receivedAt: "2026-10-01" }],
      byTag: [{ tag: "(no tag)", votes: 1, avg: 7 }],
      survey: { id: "s1", title: "Rating", publishedAt: "2026-10-01" },
      question: { id: "q1", query: "?", type: "range" },
    });
    render(<EmailSatisfactionView />);
    await waitFor(() => expect(screen.getByText("a@x.com")).toBeInTheDocument());
    expect(screen.queryByRole("columnheader", { name: "Tags" })).not.toBeInTheDocument();
  });

  it("renders the aggregate distribution view when shape is 'aggregate'", async () => {
    mockApi({
      shape: "aggregate",
      totalVotes: 10,
      avgRating: 7.3,
      distribution: [
        { rating: 1, votes: 0 },
        { rating: 5, votes: 3 },
        { rating: 10, votes: 7 },
      ],
      survey: { id: "s1", title: "Satisfaction Survey", publishedAt: "2026-10-01T00:00:00Z" },
      question: { id: "q1", query: "How satisfied are you?", type: "range" },
    });
    render(<EmailSatisfactionView />);
    await waitFor(() => expect(screen.getByText(/Rating distribution/)).toBeInTheDocument());
    expect(screen.getByText("Satisfaction Survey")).toBeInTheDocument();
    expect(screen.getByText(/How satisfied are you/)).toBeInTheDocument();
    // "10" appears twice (total votes AND the rating=10 row); confirm both.
    expect(screen.getAllByText("10").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("7.3")).toBeInTheDocument(); // avg
    expect(screen.getByText(/anonymous/)).toBeInTheDocument();
  });
});
