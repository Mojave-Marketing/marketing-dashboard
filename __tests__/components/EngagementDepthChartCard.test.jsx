import { render, screen } from "@testing-library/react";
import EngagementDepthChartCard from "../../components/EngagementDepthChartCard";

describe("EngagementDepthChartCard", () => {
  it("renders the heading and the bucket data", () => {
    const { container } = render(
      <EngagementDepthChartCard
        data={[
          { bucket: "0", count: 50 },
          { bucket: "1", count: 20 },
          { bucket: "11+", count: 2 },
        ]}
      />
    );
    expect(screen.getByText(/Engagement depth/)).toBeInTheDocument();
    const chart = container.querySelector('[data-chart="BarChart"]');
    expect(chart.getAttribute("data-rows")).toBe("3");
  });
});
