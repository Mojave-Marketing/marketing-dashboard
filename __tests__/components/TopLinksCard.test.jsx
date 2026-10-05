import { render, screen } from "@testing-library/react";
import TopLinksCard from "../../components/TopLinksCard";

describe("TopLinksCard", () => {
  it("renders a 'no data' message when the links array is empty", () => {
    render(<TopLinksCard links={[]} />);
    expect(screen.getByText(/No click data/)).toBeInTheDocument();
  });

  it("renders a 'no data' message when links is undefined", () => {
    render(<TopLinksCard />);
    expect(screen.getByText(/No click data/)).toBeInTheDocument();
  });

  it("shortens URLs to their path (or hostname for root paths) and shows click shares", () => {
    render(
      <TopLinksCard
        links={[
          { url: "https://mojave.com/products/arctidry", clicks: 60 },
          { url: "https://mojave.com/", clicks: 40 },
        ]}
      />
    );
    expect(screen.getByText("/products/arctidry")).toBeInTheDocument();
    expect(screen.getByText("mojave.com")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("falls back to the raw url when it can't be parsed", () => {
    render(<TopLinksCard links={[{ url: "not a url", clicks: 5 }]} />);
    expect(screen.getByText("not a url")).toBeInTheDocument();
  });

  it("shows an em dash for share when total clicks is zero", () => {
    render(<TopLinksCard links={[{ url: "https://x.com/a", clicks: 0 }]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
