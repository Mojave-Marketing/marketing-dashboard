import { render, screen } from "@testing-library/react";
import ComingSoon from "../../components/ComingSoon";

describe("ComingSoon", () => {
  it("renders title and description", () => {
    render(<ComingSoon title="Website Analytics" description="GA4 metrics coming soon." />);
    expect(screen.getByText("Website Analytics")).toBeInTheDocument();
    expect(screen.getByText("GA4 metrics coming soon.")).toBeInTheDocument();
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
  });
});
