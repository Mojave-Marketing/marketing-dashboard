"use client";

export default function TopLinksCard({ links }) {
  if (!links || links.length === 0) {
    return (
      <div className="card chart-card">
        <h3>Where the clicks went</h3>
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          No click data available for this send.
        </p>
      </div>
    );
  }

  const totalClicks = links.reduce((s, l) => s + l.clicks, 0);

  return (
    <div className="card chart-card">
      <h3>Where the clicks went</h3>
      <table className="links-table">
        <thead>
          <tr>
            <th>Link</th>
            <th>Clicks</th>
            <th>Share</th>
          </tr>
        </thead>
        <tbody>
          {links.map((l, i) => (
            <tr key={i}>
              <td>{l.url}</td>
              <td>{l.clicks}</td>
              <td>{totalClicks > 0 ? `${((l.clicks / totalClicks) * 100).toFixed(0)}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
