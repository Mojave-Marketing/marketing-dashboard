import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactsCard from "../../components/ContactsCard";

function makeContacts(n) {
  return Array.from({ length: n }, (_, i) => ({
    email: `user${i}@example.com`,
    opens: i % 2 === 0 ? i + 1 : 0,
    clicks: i % 3 === 0 ? 1 : 0,
    lastActive: "2026-09-01T00:00:00Z",
  }));
}

describe("ContactsCard", () => {
  it("defaults to no contacts gracefully", () => {
    render(<ContactsCard />);
    expect(screen.getByText(/0 contacts received this campaign/)).toBeInTheDocument();
    expect(screen.getByText(/No contacts match this filter/)).toBeInTheDocument();
  });

  it("shows total, opened, and clicked counts in filter chips", () => {
    render(<ContactsCard contacts={makeContacts(6)} />);
    // All: 6, Opened: user0 (1 open), user2 (3), user4 (5) → 3, Clicked: user0 and user3 → 2
    const allBtn = screen.getByRole("button", { name: /^All\s+6$/ });
    const openedBtn = screen.getByRole("button", { name: /^Opened\s+3$/ });
    const clickedBtn = screen.getByRole("button", { name: /^Clicked\s+2$/ });
    expect(allBtn).toBeInTheDocument();
    expect(openedBtn).toBeInTheDocument();
    expect(clickedBtn).toBeInTheDocument();
  });

  it("filters the visible rows to openers when Opened is clicked", async () => {
    const user = userEvent.setup();
    render(<ContactsCard contacts={makeContacts(6)} />);
    await user.click(screen.getByRole("button", { name: /^Opened/ }));
    expect(screen.getByText("user0@example.com")).toBeInTheDocument();
    expect(screen.getByText("user2@example.com")).toBeInTheDocument();
    expect(screen.queryByText("user1@example.com")).not.toBeInTheDocument();
  });

  it("filters by search term across emails", async () => {
    const user = userEvent.setup();
    render(<ContactsCard contacts={makeContacts(6)} />);
    await user.type(screen.getByPlaceholderText(/Search by email/), "user3");
    expect(screen.getByText("user3@example.com")).toBeInTheDocument();
    expect(screen.queryByText("user1@example.com")).not.toBeInTheDocument();
  });

  it("paginates when results exceed PAGE_SIZE", async () => {
    const user = userEvent.setup();
    render(<ContactsCard contacts={makeContacts(30)} />);
    // First page: user0..user24. user25 is on page 2.
    expect(screen.getByText("user0@example.com")).toBeInTheDocument();
    expect(screen.queryByText("user25@example.com")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("user25@example.com")).toBeInTheDocument();
    expect(screen.queryByText("user0@example.com")).not.toBeInTheDocument();
  });

  it("renders em dash for zero opens or clicks", () => {
    render(
      <ContactsCard
        contacts={[{ email: "a@b.c", opens: 0, clicks: 0, lastActive: "2026-09-01T00:00:00Z" }]}
      />
    );
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});
