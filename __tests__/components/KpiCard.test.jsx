import { render, screen } from "@testing-library/react";
import KpiCard from "../../components/KpiCard";

describe("KpiCard", () => {
  it("renders a number value with thousands separators by default", () => {
    render(<KpiCard label="Sent" value={1234} />);
    expect(screen.getByText("Sent")).toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("formats percent values with one decimal and % sign", () => {
    render(<KpiCard label="Open rate" value={0.3156} format="percent" />);
    expect(screen.getByText("31.6%")).toBeInTheDocument();
  });

  it("formats number values with thousands separators", () => {
    render(<KpiCard label="Delivered" value={1234567} format="number" />);
    expect(screen.getByText("1,234,567")).toBeInTheDocument();
  });

  it("shows a positive pill when value exceeds benchmark", () => {
    render(<KpiCard label="Open rate" value={0.3} format="percent" benchmark={0.26} />);
    expect(screen.getByText(/\+4\.0 pts/)).toBeInTheDocument();
    expect(screen.getByText(/\+4\.0 pts/)).toHaveClass("good");
  });

  it("shows a negative pill when value trails benchmark", () => {
    render(<KpiCard label="Open rate" value={0.2} format="percent" benchmark={0.26} />);
    const pill = screen.getByText(/-6\.0 pts/);
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveClass("bad");
  });

  it("shows an 'at benchmark' pill when value matches benchmark", () => {
    render(<KpiCard label="Open rate" value={0.26} format="percent" benchmark={0.26} />);
    expect(screen.getByText("At benchmark")).toBeInTheDocument();
  });

  it("hides the pill when no benchmark is supplied", () => {
    const { container } = render(<KpiCard label="Sent" value={100} />);
    expect(container.querySelector(".pill")).toBeNull();
  });

  it("hides the pill when benchmark is explicitly null", () => {
    const { container } = render(<KpiCard label="Sent" value={100} benchmark={null} />);
    expect(container.querySelector(".pill")).toBeNull();
  });
});
