"use client";

import { useEffect, useState } from "react";

function fmt(rate) {
  return (rate * 100).toFixed(1);
}

export default function LinkedInView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/linkedin")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="state-message">Loading LinkedIn data from Buffer…</div>;

  if (error) {
    return (
      <div className="state-message">
        <strong>Couldn&apos;t load data:</strong> {error}
        <br />
        Check that BUFFER_API is set correctly in your environment variables and that a
        LinkedIn account is connected in Buffer.
      </div>
    );
  }

  const { profile, posts, summary } = data;

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: "24px" }}>
        <div className="card">
          <div className="kpi-label">Followers</div>
          <div className="kpi-value">
            {profile.followers != null ? profile.followers.toLocaleString() : "—"}
          </div>
        </div>
        <div className="card">
          <div className="kpi-label">Avg impressions / post</div>
          <div className="kpi-value">{summary.avgImpressions.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Total link clicks</div>
          <div className="kpi-value">{summary.totalClicks.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Avg engagement rate</div>
          <div className="kpi-value">{fmt(summary.avgEngagementRate)}%</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
            reactions + comments + shares / impressions
          </div>
        </div>
      </div>

      <h2 className="section-title">Recent posts</h2>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="sends-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Post</th>
              <th>Impressions</th>
              <th>Clicks</th>
              <th>Reactions</th>
              <th>Comments</th>
              <th>Eng. rate</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  {p.sentAt ? new Date(p.sentAt).toLocaleDateString() : "—"}
                </td>
                <td className="sends-table-title">
                  {p.text.length > 80 ? p.text.slice(0, 80) + "…" : p.text}
                </td>
                <td>{p.stats.impressions.toLocaleString()}</td>
                <td>{p.stats.clicks.toLocaleString()}</td>
                <td>{p.stats.reactions.toLocaleString()}</td>
                <td>{p.stats.comments.toLocaleString()}</td>
                <td>{fmt(p.stats.engagementRate)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="footer-note">
        Data sourced from Buffer (last {summary.totalPostsFetched} sent posts).
        {summary.postsAnalyzed < summary.totalPostsFetched && (
          <>
            {" "}
            {summary.totalPostsFetched - summary.postsAnalyzed} post
            {summary.totalPostsFetched - summary.postsAnalyzed > 1 ? "s" : ""} had no
            impression data and are excluded from averages.
          </>
        )}
      </div>
    </>
  );
}
