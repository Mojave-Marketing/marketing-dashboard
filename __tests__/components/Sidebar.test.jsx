import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

jest.mock("next/link", () => {
  const React = require("react");
  function MockLink({ href, children, ...rest }) {
    return React.createElement("a", { href, ...rest }, children);
  }
  return { __esModule: true, default: MockLink };
});

const { usePathname } = require("next/navigation");
const Sidebar = require("../../components/Sidebar").default;

const FORMS = [
  { id: "arctidry-training", name: "Arctidry Training" },
  { id: "rep-company-feedback", name: "Rep Company Feedback" },
];

describe("Sidebar", () => {
  afterEach(() => jest.clearAllMocks());

  it("renders all top-level sections", () => {
    usePathname.mockReturnValue("/");
    render(<Sidebar forms={FORMS} />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Marketing Emails")).toBeInTheDocument();
    expect(screen.getByText("Website Analytics")).toBeInTheDocument();
    expect(screen.getByText("LinkedIn Analytics")).toBeInTheDocument();
    expect(screen.getByText("Survey Responses")).toBeInTheDocument();
    // Runbook appears twice (section title + nav item); getAllByText confirms both.
    expect(screen.getAllByText("Runbook")).toHaveLength(2);
  });

  it("renders one sidebar item per form", () => {
    usePathname.mockReturnValue("/");
    render(<Sidebar forms={FORMS} />);
    expect(screen.getByRole("link", { name: "Arctidry Training" })).toHaveAttribute(
      "href",
      "/surveys/arctidry-training"
    );
    expect(screen.getByRole("link", { name: "Rep Company Feedback" })).toHaveAttribute(
      "href",
      "/surveys/rep-company-feedback"
    );
  });

  it("marks Marketing Emails section active when pathname starts with /emails", () => {
    usePathname.mockReturnValue("/emails/trends");
    const { container } = render(<Sidebar forms={FORMS} />);
    const active = container.querySelector(".sidebar-section-title--active");
    expect(active).toHaveTextContent("Marketing Emails");
  });

  it("marks Survey Responses active when pathname starts with /surveys", () => {
    usePathname.mockReturnValue("/surveys/arctidry-training");
    const { container } = render(<Sidebar forms={FORMS} />);
    const active = container.querySelector(".sidebar-section-title--active");
    expect(active).toHaveTextContent("Survey Responses");
  });

  it("tags the exact matching item with the active class", () => {
    usePathname.mockReturnValue("/emails/trends");
    const { container } = render(<Sidebar forms={FORMS} />);
    const activeItems = container.querySelectorAll(".sidebar-item--active");
    expect(activeItems).toHaveLength(1);
    expect(activeItems[0]).toHaveTextContent("Trends & Baseline");
  });

  it("shows Soon badge on Website and LinkedIn sections", () => {
    usePathname.mockReturnValue("/");
    render(<Sidebar forms={FORMS} />);
    expect(screen.getAllByText("Soon")).toHaveLength(2);
  });

  it("collapses when the toggle is clicked", async () => {
    const user = userEvent.setup();
    usePathname.mockReturnValue("/");
    const { container } = render(<Sidebar forms={FORMS} />);
    const toggle = screen.getByLabelText(/Collapse sidebar/);
    expect(container.querySelector(".sidebar--collapsed")).toBeNull();
    await user.click(toggle);
    expect(container.querySelector(".sidebar--collapsed")).not.toBeNull();
  });

  it("calls /api/logout and redirects when Log out is clicked", async () => {
    const user = userEvent.setup();
    usePathname.mockReturnValue("/");
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    // JSDOM makes location read-only; redefine with a settable href spy.
    const originalLocation = window.location;
    delete window.location;
    window.location = { href: "" };

    render(<Sidebar forms={FORMS} />);
    await user.click(screen.getByRole("button", { name: /Log out/ }));

    expect(global.fetch).toHaveBeenCalledWith("/api/logout", { method: "POST" });
    expect(window.location.href).toBe("/login");

    window.location = originalLocation;
  });

  it("renders with zero forms without crashing", () => {
    usePathname.mockReturnValue("/");
    render(<Sidebar />);
    expect(screen.getByText("Survey Responses")).toBeInTheDocument();
  });
});
