import { render, screen, waitFor } from "@testing-library/react";
import TrendsView from "../../components/TrendsView";

const originalFetch = global.fetch;

function mockApi(body, { ok = true } = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  });
}

function makeSend(i, overrides = {}) {
  return {
    id: `s${i}`,
    title: `Send ${i}`,
    sendTime: `2026-0${(i % 9) + 1}-01T00:00:00Z`,
    sent: 100,
    uniqueOpens: 30,
    uniqueClicks: 10,
    openRate: 0.3,
    clickRate: 0.05,
    clickToOpenRate: 0.33,
    bounces: 1,
    unsubscribes: 0,
    rollingOpenRate: null,
    rollingClickRate: null,
    ...overrides,
  };
}

describe("TrendsView", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("renders the loading state until fetch resolves", async () => {
    let resolve;
    global.fetch = jest.fn().mockImplementation((..._args) => new Promise((r) => (resolve = r)));
    render(<TrendsView />);
    expect(screen.getByText(/Loading trends data/)).toBeInTheDocument();
    resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          sends: [],
          benchmarks: { openRate: 0.26, clickRate: 0.03 },
          takeaways: [],
          total: 0,
        }),
    });
    await waitFor(() => expect(screen.queryByText(/Loading/)).not.toBeInTheDocument());
  });

  it("shows the error state when API returns an error", async () => {
    mockApi({ error: "mailchimp 500" });
    render(<TrendsView />);
    await waitFor(() => expect(screen.getByText(/mailchimp 500/)).toBeInTheDocument());
  });

  it("shows a 'no sends' message when sends array is empty", async () => {
    mockApi({ sends: [], benchmarks: { openRate: 0.26, clickRate: 0.03 }, takeaways: [], total: 0 });
    render(<TrendsView />);
    await waitFor(() => expect(screen.getByText(/No sends found/)).toBeInTheDocument());
  });

  it("renders KPI cards, chart cards, and the sends table on happy path", async () => {
    const sends = [makeSend(1), makeSend(2, { openRate: 0.4 })];
    mockApi({
      sends,
      benchmarks: { openRate: 0.26, clickRate: 0.03 },
      takeaways: [{ title: "T1", body: "Body1" }],
      total: 2,
    });
    render(<TrendsView />);
    await waitFor(() => expect(screen.getByText("Sends analyzed")).toBeInTheDocument());
    expect(screen.getByText("T1")).toBeInTheDocument(); // takeaway
    expect(screen.getByText("All sends")).toBeInTheDocument();
    expect(screen.getByText("Send 1")).toBeInTheDocument();
    expect(screen.getByText("Send 2")).toBeInTheDocument();
    expect(screen.getByText("Open rate over time")).toBeInTheDocument();
    expect(screen.getByText("Click rate over time")).toBeInTheDocument();
  });

  it("shows the trend KPI only when there are 6+ sends", async () => {
    const few = [makeSend(1), makeSend(2)];
    mockApi({
      sends: few,
      benchmarks: { openRate: 0.26, clickRate: 0.03 },
      takeaways: [],
      total: 2,
    });
    const { rerender, unmount } = render(<TrendsView />);
    await waitFor(() => expect(screen.getByText("Sends analyzed")).toBeInTheDocument());
    expect(screen.queryByText("Open rate trend")).not.toBeInTheDocument();
    unmount();

    const many = Array.from({ length: 6 }, (_, i) => makeSend(i, { openRate: i < 3 ? 0.2 : 0.4 }));
    mockApi({ sends: many, benchmarks: { openRate: 0.26, clickRate: 0.03 }, takeaways: [], total: 6 });
    render(<TrendsView />);
    await waitFor(() => expect(screen.getByText("Open rate trend")).toBeInTheDocument());
  });
});
