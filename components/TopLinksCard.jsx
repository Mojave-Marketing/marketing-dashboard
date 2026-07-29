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
            <th style={{ textAlign: "right" }}>Clicks</th>
            <th style={{ textAlign: "right" }}>Share</th>
          </tr>
        </thead>
        <tbody>
          {links.map((l, i) => {
            let display = l.url;
            try {
              const u = new URL(l.url);
              display = (u.pathname === "/" ? u.hostname : u.pathname).replace(/\/$/, "");
            } catch {}
            return (
              <tr key={i}>
                <td className="links-table-url" title={l.url}>{display}</td>
                <td style={{ textAlign: "right" }}>{l.clicks}</td>
                <td style={{ textAlign: "right" }}>{totalClicks > 0 ? `${((l.clicks / totalClicks) * 100).toFixed(0)}%` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
