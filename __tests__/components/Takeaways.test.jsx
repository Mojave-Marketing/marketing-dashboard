import { render, screen } from "@testing-library/react";
import Takeaways from "../../components/Takeaways";

describe("Takeaways", () => {
  it("renders each takeaway as a card with title and body", () => {
    render(
      <Takeaways
        takeaways={[
          { title: "Open rate", body: "Above benchmark." },
          { title: "Click rate", body: "Below benchmark." },
        ]}
      />
    );
    expect(screen.getByText("Leadership takeaways")).toBeInTheDocument();
    expect(screen.getByText("Open rate")).toBeInTheDocument();
    expect(screen.getByText("Above benchmark.")).toBeInTheDocument();
    expect(screen.getByText("Click rate")).toBeInTheDocument();
    expect(screen.getByText("Below benchmark.")).toBeInTheDocument();
  });

  it("renders the section heading with no cards when takeaways is empty", () => {
    const { container } = render(<Takeaways takeaways={[]} />);
    expect(screen.getByText("Leadership takeaways")).toBeInTheDocument();
    expect(container.querySelectorAll(".takeaway-card")).toHaveLength(0);
  });
});
