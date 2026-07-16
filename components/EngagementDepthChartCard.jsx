"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function EngagementDepthChartCard({ data }) {
  return (
    <div className="card chart-card">
      <h3>Engagement depth (opens per recipient)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ left: 0, right: 10 }}>
          <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: "#7B7490" }} />
          <YAxis tick={{ fontSize: 12, fill: "#7B7490" }} allowDecimals={false} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="count" fill="#7C499F" radius={[6, 6, 0, 0]} barSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
