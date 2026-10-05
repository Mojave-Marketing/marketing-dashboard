import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CalendarView from "../../components/CalendarView";

// EVENTS array in CalendarView is hardcoded. The tests pin to events we know
// are in that list: Fall Marketing Push (Sep 2026), AHR Expo (Jan 2027), etc.
describe("CalendarView", () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-09-15T12:00:00Z"));
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  it("opens on the current month", () => {
    render(<CalendarView />);
    expect(screen.getByText(/September 2026/)).toBeInTheDocument();
  });

  it("shows the day-of-week headers", () => {
    render(<CalendarView />);
    for (const d of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      expect(screen.getByText(d)).toBeInTheDocument();
    }
  });

  it("renders the Fall Marketing Push event across September", () => {
    render(<CalendarView />);
    const events = screen.getAllByText("Fall Marketing Push");
    expect(events.length).toBeGreaterThan(0);
  });

  it("navigates to the next month when the › button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<CalendarView />);
    await user.click(screen.getByRole("button", { name: "›" }));
    expect(screen.getByText(/October 2026/)).toBeInTheDocument();
  });

  it("navigates backwards and forwards symmetrically", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<CalendarView />);
    await user.click(screen.getByRole("button", { name: "‹" }));
    expect(screen.getByText(/August 2026/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "›" }));
    expect(screen.getByText(/September 2026/)).toBeInTheDocument();
  });

  it("shows the empty-state message in the detail panel on first render", () => {
    render(<CalendarView />);
    expect(screen.getByText(/Select an event to see details/)).toBeInTheDocument();
  });

  it("opens the detail panel when an event chip is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<CalendarView />);
    const chip = screen.getAllByText("Fall Marketing Push")[0];
    await user.click(chip);
    expect(screen.getByText(/September awareness campaign/)).toBeInTheDocument();
    expect(screen.getByText("Plan Notes")).toBeInTheDocument();
  });

  it("renders location on trade-show events", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<CalendarView />);
    // Navigate to January 2027 for AHR Expo
    for (let i = 0; i < 4; i++) {
      await user.click(screen.getByRole("button", { name: "›" }));
    }
    expect(screen.getByText(/January 2027/)).toBeInTheDocument();
    const chip = screen.getAllByText("AHR Expo 2027")[0];
    await user.click(chip);
    expect(screen.getByText("Las Vegas, NV")).toBeInTheDocument();
    expect(screen.getByText("Trade Show")).toBeInTheDocument();
  });

  it("toggles the detail panel off when the same chip is clicked twice", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<CalendarView />);
    const chip = screen.getAllByText("Fall Marketing Push")[0];
    await user.click(chip);
    expect(screen.getByText(/September awareness campaign/)).toBeInTheDocument();
    await user.click(chip);
    expect(screen.queryByText(/September awareness campaign/)).not.toBeInTheDocument();
    expect(screen.getByText(/Select an event to see details/)).toBeInTheDocument();
  });

  it("closes the detail panel via the × button", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<CalendarView />);
    await user.click(screen.getAllByText("Fall Marketing Push")[0]);
    await user.click(screen.getByRole("button", { name: "×" }));
    expect(screen.queryByText(/September awareness campaign/)).not.toBeInTheDocument();
  });
});
