"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = ["#4f46e5", "#6366f1", "#818cf8", "#a5b4fc"];

export default function FunnelChartCard({ data }) {
  return (
    <div className="card chart-card">
      <h3>Send funnel</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="stage" width={80} tick={{ fontSize: 13 }} />
          <Tooltip formatter={(v) => v.toLocaleString()} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
