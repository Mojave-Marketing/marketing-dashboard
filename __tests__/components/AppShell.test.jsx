import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

jest.mock("../../components/Sidebar", () => {
  function MockSidebar({ forms }) {
    return <div data-testid="sidebar">sidebar(forms={forms?.length ?? 0})</div>;
  }
  return { __esModule: true, default: MockSidebar };
});

const { usePathname } = require("next/navigation");
const AppShell = require("../../components/AppShell").default;

describe("AppShell", () => {
  afterEach(() => jest.clearAllMocks());

  it("renders children bare (no sidebar) on /login", () => {
    usePathname.mockReturnValue("/login");
    render(
      <AppShell forms={[{ id: "a", name: "A" }]}>
        <div>LOGIN CONTENT</div>
      </AppShell>
    );
    expect(screen.getByText("LOGIN CONTENT")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
  });

  it("renders sidebar + main wrapper for every other path", () => {
    usePathname.mockReturnValue("/emails");
    render(
      <AppShell forms={[{ id: "a", name: "A" }, { id: "b", name: "B" }]}>
        <div>MAIN CONTENT</div>
      </AppShell>
    );
    expect(screen.getByText("MAIN CONTENT")).toBeInTheDocument();
    const sidebar = screen.getByTestId("sidebar");
    expect(sidebar).toHaveTextContent("sidebar(forms=2)");
  });
});
