"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

function fmt(rate) {
  return (rate * 100).toFixed(1);
}

function MetricChart({ chartData, dataKey, rollingKey, benchmarkPct, color, title }) {
  return (
    <div className="card chart-card">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={210}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f2f4" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: "#6b7280" }}
            domain={["auto", "auto"]}
          />
          <Tooltip
            formatter={(value, name) => [`${value}%`, name]}
            contentStyle={{ fontSize: 12 }}
            labelFormatter={(label, payload) => {
              const item = payload?.[0]?.payload;
              return item ? `${item.fullDate} — ${item.title}` : label;
            }}
          />
          <ReferenceLine
            y={benchmarkPct}
            stroke="#9ca3af"
            strokeDasharray="4 4"
            label={{
              value: `Benchmark ${benchmarkPct}%`,
              position: "insideTopRight",
              fontSize: 10,
              fill: "#9ca3af",
            }}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3, fill: color }}
            name="Actual"
          />
          <Line
            type="monotone"
            dataKey={rollingKey}
            stroke={color}
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
            name="3-send avg"
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function TrendsView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/campaigns/trends")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="state-message">Loading trends data…</div>;
  if (error) return <div className="state-message"><strong>Error:</strong> {error}</div>;
  if (!data || data.sends.length === 0) {
    return <div className="state-message">No sends found.</div>;
  }

  const { sends, benchmarks } = data;

  const chartData = sends.map((s) => ({
    date: new Date(s.sendTime).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    fullDate: new Date(s.sendTime).toLocaleDateString(),
    title: s.title,
    openRate: +fmt(s.openRate),
    clickRate: +fmt(s.clickRate),
    rollingOpen: s.rollingOpenRate != null ? +fmt(s.rollingOpenRate) : null,
    rollingClick: s.rollingClickRate != null ? +fmt(s.rollingClickRate) : null,
  }));

  const avgOpen = sends.reduce((sum, s) => sum + s.openRate, 0) / sends.length;
  const avgClick = sends.reduce((sum, s) => sum + s.clickRate, 0) / sends.length;
  const bestSend = sends.reduce((b, s) => (s.openRate > b.openRate ? s : b), sends[0]);

  // Trend: last-3 avg vs first-3 avg (requires 6+ sends)
  let trend = null;
  if (sends.length >= 6) {
    const recent = sends.slice(-3).reduce((sum, s) => sum + s.openRate, 0) / 3;
    const older = sends.slice(0, 3).reduce((sum, s) => sum + s.openRate, 0) / 3;
    trend = recent - older;
  }

  const benchOpenPct = +fmt(benchmarks.openRate);
  const benchClickPct = +fmt(benchmarks.clickRate);

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: "24px" }}>
        <div className="card">
          <div className="kpi-label">Sends analyzed</div>
          <div className="kpi-value">{sends.length}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Avg open rate</div>
          <div className="kpi-value">{fmt(avgOpen)}%</div>
          <span className={`pill ${avgOpen >= benchmarks.openRate ? "good" : "bad"}`}>
            {avgOpen >= benchmarks.openRate ? "+" : ""}
            {((avgOpen - benchmarks.openRate) * 100).toFixed(1)} pts vs. benchmark
          </span>
        </div>
        <div className="card">
          <div className="kpi-label">Best open rate</div>
          <div className="kpi-value">{fmt(bestSend.openRate)}%</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            {new Date(bestSend.sendTime).toLocaleDateString()}
          </div>
        </div>
        <div className="card">
          <div className="kpi-label">Avg click rate</div>
          <div className="kpi-value">{fmt(avgClick)}%</div>
          <span className={`pill ${avgClick >= benchmarks.clickRate ? "good" : "bad"}`}>
            {avgClick >= benchmarks.clickRate ? "+" : ""}
            {((avgClick - benchmarks.clickRate) * 100).toFixed(1)} pts vs. benchmark
          </span>
        </div>
        {trend !== null && (
          <div className="card">
            <div className="kpi-label">Open rate trend</div>
            <div
              className="kpi-value"
              style={{ color: trend >= 0 ? "var(--good)" : "var(--bad)" }}
            >
              {trend >= 0 ? "+" : ""}{(trend * 100).toFixed(1)}pts
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
              recent 3 vs. first 3
            </div>
          </div>
        )}
      </div>

      <div className="charts-grid" style={{ marginBottom: "32px" }}>
        <MetricChart
          chartData={chartData}
          dataKey="openRate"
          rollingKey="rollingOpen"
          benchmarkPct={benchOpenPct}
          color="var(--accent)"
          title="Open rate over time"
        />
        <MetricChart
          chartData={chartData}
          dataKey="clickRate"
          rollingKey="rollingClick"
          benchmarkPct={benchClickPct}
          color="#10b981"
          title="Click rate over time"
        />
      </div>

      <h2 className="section-title">All sends</h2>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="sends-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Campaign</th>
              <th>Sent</th>
              <th>Open rate</th>
              <th>Click rate</th>
              <th>CTOR</th>
              <th>Bounces</th>
              <th>Unsubs</th>
            </tr>
          </thead>
          <tbody>
            {[...sends].reverse().map((s) => (
              <tr key={s.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  {new Date(s.sendTime).toLocaleDateString()}
                </td>
                <td className="sends-table-title">{s.title}</td>
                <td>{s.sent.toLocaleString()}</td>
                <td>{fmt(s.openRate)}%</td>
                <td>{fmt(s.clickRate)}%</td>
                <td>{fmt(s.clickToOpenRate)}%</td>
                <td>{s.bounces}</td>
                <td>{s.unsubscribes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="footer-note">
        Showing up to 30 most recent sends. Dashed line = 3-send rolling average.
        Data pulled live from Mailchimp's Reports API.
      </div>
    </>
  );
}
