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
    mockApi({ shape: "none", message: "No poll found in the 10 most recent campaigns." });
    render(<EmailSatisfactionView />);
    await waitFor(() => expect(screen.getByText(/No poll results yet/)).toBeInTheDocument());
    expect(screen.getByText(/No poll found in the 10 most recent/)).toBeInTheDocument();
  });

  it("renders the per-recipient table when shape is 'per-recipient'", async () => {
    mockApi({
      shape: "per-recipient",
      pollId: "217",
      total: 2,
      responses: [
        { Email: "a@x.com", Rating: 9, _receivedAt: "2026-10-01T00:00:00Z" },
        { Email: "b@x.com", Rating: 4, _receivedAt: "2026-09-01T00:00:00Z" },
      ],
      campaign: { id: "c1", title: "Weekly", sendTime: "2026-09-01T00:00:00Z" },
    });
    render(<EmailSatisfactionView />);
    await waitFor(() => expect(screen.getByText("a@x.com")).toBeInTheDocument());
    expect(screen.getByText("b@x.com")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Weekly")).toBeInTheDocument();
    expect(screen.getByText(/Avg Score \(out of 10\)/)).toBeInTheDocument();
    expect(screen.getByText("6.5")).toBeInTheDocument(); // (9 + 4) / 2
  });

  it("renders the aggregate distribution view when shape is 'aggregate'", async () => {
    mockApi({
      shape: "aggregate",
      pollId: "217",
      totalVotes: 10,
      avgRating: 7.3,
      distribution: [
        { rating: 1, votes: 0 },
        { rating: 5, votes: 3 },
        { rating: 10, votes: 7 },
      ],
      campaign: { id: "c1", title: "Satisfaction Push", sendTime: "2026-10-01T00:00:00Z" },
    });
    render(<EmailSatisfactionView />);
    await waitFor(() => expect(screen.getByText(/Rating distribution/)).toBeInTheDocument());
    expect(screen.getByText("Satisfaction Push")).toBeInTheDocument();
    // "10" appears twice (total votes AND the rating=10 row); confirm both.
    expect(screen.getAllByText("10").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("7.3")).toBeInTheDocument(); // avg
    expect(screen.getByText(/anonymous/)).toBeInTheDocument();
  });
});
