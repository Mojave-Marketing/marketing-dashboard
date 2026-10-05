import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SurveyTable from "../../components/SurveyTable";

const originalFetch = global.fetch;

function mockApi(body, { ok = true } = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  });
}

describe("SurveyTable", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("shows a loading state before fetch resolves", async () => {
    let resolve;
    global.fetch = jest.fn().mockImplementation(
      () => new Promise((r) => (resolve = r))
    );
    render(<SurveyTable formId="f" />);
    expect(screen.getByText(/Loading responses/)).toBeInTheDocument();
    resolve({ ok: true, json: () => Promise.resolve({ responses: [], total: 0 }) });
    await waitFor(() => expect(screen.queryByText(/Loading/)).not.toBeInTheDocument());
  });

  it("shows the unconfigured banner when the API reports unconfigured", async () => {
    mockApi({ responses: [], total: 0, unconfigured: true });
    render(<SurveyTable formId="f" />);
    await waitFor(() =>
      expect(screen.getByText(/Blob storage is not configured/)).toBeInTheDocument()
    );
  });

  it("shows the error state when the API returns an error field", async () => {
    mockApi({ error: "backend down" });
    render(<SurveyTable formId="f" />);
    await waitFor(() => expect(screen.getByText(/Error: backend down/)).toBeInTheDocument());
  });

  it("renders the empty state when there are no responses", async () => {
    mockApi({ responses: [], total: 0 });
    render(<SurveyTable formId="f" />);
    await waitFor(() => expect(screen.getByText(/No responses yet/)).toBeInTheDocument());
  });

  it("renders responses with detected name and primary rating", async () => {
    mockApi({
      responses: [
        {
          "Your Name": "Jane",
          "Rating (1-10)": "9",
          Comments: "Great training",
          _receivedAt: "2026-09-01T00:00:00Z",
        },
      ],
      total: 1,
    });
    render(<SurveyTable formId="f" />);
    await waitFor(() => expect(screen.getByText("Jane")).toBeInTheDocument());
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("Total Responses").previousSibling).toHaveTextContent("1");
    expect(screen.getByText(/Avg Score \(out of 10\)/)).toBeInTheDocument();
  });

  it("falls back to Anonymous when no name field is present", async () => {
    mockApi({
      responses: [
        { comment: "Thanks", _receivedAt: "2026-09-01T00:00:00Z" },
      ],
      total: 1,
    });
    render(<SurveyTable formId="f" />);
    await waitFor(() => expect(screen.getByText("Anonymous")).toBeInTheDocument());
  });

  it("expands a row to show all detail fields when clicked", async () => {
    const user = userEvent.setup();
    mockApi({
      responses: [
        {
          Name: "Ana",
          Rating: "8",
          How_can_we_improve: "More examples",
          _receivedAt: "2026-09-01T00:00:00Z",
        },
      ],
      total: 1,
    });
    render(<SurveyTable formId="f" />);
    await waitFor(() => expect(screen.getByText("Ana")).toBeInTheDocument());
    expect(screen.queryByText("More examples")).not.toBeInTheDocument();
    await user.click(screen.getByText("Ana"));
    expect(screen.getByText("More examples")).toBeInTheDocument();
    expect(screen.getByText(/How can we improve/)).toBeInTheDocument();
  });

  it("uses a 5-point scale when all ratings are <= 5", async () => {
    mockApi({
      responses: [
        { Name: "A", score: "3", _receivedAt: "2026-09-01T00:00:00Z" },
        { Name: "B", score: "5", _receivedAt: "2026-09-02T00:00:00Z" },
      ],
      total: 2,
    });
    render(<SurveyTable formId="f" />);
    await waitFor(() => expect(screen.getByText(/Avg Score \(out of 5\)/)).toBeInTheDocument());
  });
});
