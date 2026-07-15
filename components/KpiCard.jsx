"use client";

function formatValue(value, format) {
  if (format === "percent") return `${(value * 100).toFixed(1)}%`;
  if (format === "number") return value.toLocaleString();
  return value;
}

export default function KpiCard({ label, value, format = "number", benchmark }) {
  let pill = null;

  if (benchmark !== undefined && benchmark !== null) {
    const diff = value - benchmark;
    const diffPct = (diff * 100).toFixed(1);
    if (Math.abs(diff) < 0.001) {
      pill = <span className="pill neutral">At benchmark</span>;
    } else if (diff > 0) {
      pill = <span className="pill good">+{diffPct} pts vs. benchmark</span>;
    } else {
      pill = <span className="pill bad">{diffPct} pts vs. benchmark</span>;
    }
  }

  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{formatValue(value, format)}</div>
      {pill}
    </div>
  );
}
