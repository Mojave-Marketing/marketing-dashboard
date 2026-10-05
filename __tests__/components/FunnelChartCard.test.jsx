import { render, screen } from "@testing-library/react";
import FunnelChartCard from "../../components/FunnelChartCard";

describe("FunnelChartCard", () => {
  it("renders the heading and feeds the funnel rows into BarChart", () => {
    const { container } = render(
      <FunnelChartCard
        data={[
          { stage: "Sent", value: 100 },
          { stage: "Delivered", value: 97 },
          { stage: "Opened", value: 30 },
          { stage: "Clicked", value: 10 },
        ]}
      />
    );
    expect(screen.getByText("Send funnel")).toBeInTheDocument();
    const chart = container.querySelector('[data-chart="BarChart"]');
    expect(chart).toBeInTheDocument();
    expect(chart.getAttribute("data-rows")).toBe("4");
  });

  it("renders without crashing on empty data", () => {
    const { container } = render(<FunnelChartCard data={[]} />);
    expect(container.querySelector('[data-chart="BarChart"]').getAttribute("data-rows")).toBe("0");
  });
});
