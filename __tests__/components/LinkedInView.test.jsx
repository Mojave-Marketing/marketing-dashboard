import { render, screen, waitFor } from "@testing-library/react";
import LinkedInView from "../../components/LinkedInView";

const originalFetch = global.fetch;

function mockApi(body, { ok = true } = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  });
}

describe("LinkedInView", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("shows the loading state until fetch resolves", async () => {
    let resolve;
    global.fetch = jest.fn().mockImplementation(
      () => new Promise((r) => (resolve = r))
    );
    render(<LinkedInView />);
    expect(screen.getByText(/Loading LinkedIn data/)).toBeInTheDocument();
    resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          profile: { name: "Mojave", followers: 100 },
          posts: [],
          summary: { postsAnalyzed: 0, totalPostsFetched: 0, avgImpressions: 0, totalClicks: 0, avgEngagementRate: 0 },
        }),
    });
    await waitFor(() => expect(screen.queryByText(/Loading/)).not.toBeInTheDocument());
  });

  it("shows the error state with hint text when the API returns an error", async () => {
    mockApi({ error: "BUFFER_API not configured" });
    render(<LinkedInView />);
    await waitFor(() =>
      expect(screen.getByText(/BUFFER_API not configured/)).toBeInTheDocument()
    );
    expect(screen.getByText(/BUFFER_API is set correctly/)).toBeInTheDocument();
  });

  it("renders KPIs and the post table on happy path", async () => {
    mockApi({
      profile: { name: "Mojave", followers: 1234 },
      posts: [
        {
          id: "p1",
          text: "This is a post about HVAC equipment and training",
          sentAt: "2026-09-01T00:00:00Z",
          stats: { impressions: 1000, clicks: 50, reactions: 10, comments: 3, shares: 2, engagementRate: 0.065 },
        },
      ],
      summary: { postsAnalyzed: 1, totalPostsFetched: 1, avgImpressions: 1000, totalClicks: 50, avgEngagementRate: 0.065 },
    });
    render(<LinkedInView />);
    await waitFor(() => expect(screen.getByText("1,234")).toBeInTheDocument());
    expect(screen.getByText("Followers")).toBeInTheDocument();
    expect(screen.getByText(/This is a post about HVAC/)).toBeInTheDocument();
    // "1,000" appears twice: once as the post's impressions cell, once as avg impressions KPI.
    expect(screen.getAllByText("1,000").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("6.5%").length).toBeGreaterThanOrEqual(1);
  });

  it("truncates long post text at 80 chars", async () => {
    const longText = "x".repeat(200);
    mockApi({
      profile: { name: "m", followers: 1 },
      posts: [
        { id: "p1", text: longText, sentAt: "2026-09-01T00:00:00Z", stats: { impressions: 1, clicks: 0, reactions: 0, comments: 0, shares: 0, engagementRate: 0 } },
      ],
      summary: { postsAnalyzed: 1, totalPostsFetched: 1, avgImpressions: 1, totalClicks: 0, avgEngagementRate: 0 },
    });
    render(<LinkedInView />);
    await waitFor(() => expect(screen.getByText(/^x+…$/)).toBeInTheDocument());
  });

  it("notes excluded posts when some had no impression data", async () => {
    mockApi({
      profile: { name: "m", followers: 1 },
      posts: [],
      summary: { postsAnalyzed: 3, totalPostsFetched: 5, avgImpressions: 100, totalClicks: 10, avgEngagementRate: 0.01 },
    });
    render(<LinkedInView />);
    await waitFor(() => expect(screen.getByText(/2 posts had no impression data/)).toBeInTheDocument());
  });
});
