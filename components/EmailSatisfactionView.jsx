"use client";

import { useEffect, useState } from "react";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function TagBreakdownCard({ byTag }) {
  if (!byTag || byTag.length === 0) return null;
  return (
    <div className="card" style={{ padding: 24, marginTop: 20 }}>
      <h3 style={{ marginBottom: 16 }}>Breakdown by tag</h3>
      <table className="survey-table">
        <thead>
          <tr>
            <th>Tag</th>
            <th style={{ textAlign: "right" }}>Avg Score</th>
            <th style={{ textAlign: "right" }}>Votes</th>
          </tr>
        </thead>
        <tbody>
          {byTag.map((g) => (
            <tr key={g.tag}>
              <td>{g.tag}</td>
              <td style={{ textAlign: "right" }}>{g.avg.toFixed(1)}</td>
              <td style={{ textAlign: "right" }}>{g.votes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PerRecipientTable({ data }) {
  const avg = data.responses.length
    ? data.responses.reduce((s, r) => s + Number(r.Rating), 0) / data.responses.length
    : 0;
  const latest = data.responses[0]?._receivedAt;
  const anyTags = data.responses.some((r) => Array.isArray(r.Tags) && r.Tags.length > 0);

  return (
    <div className="survey-table-wrap">
      <div className="survey-summary-row">
        <div className="survey-summary-card">
          <span className="survey-summary-value">{data.total}</span>
          <span className="survey-summary-label">Total Votes</span>
        </div>
        <div className="survey-summary-card">
          <span className="survey-summary-value">{avg.toFixed(1)}</span>
          <span className="survey-summary-label">Avg Score (out of 10)</span>
        </div>
        {latest && (
          <div className="survey-summary-card">
            <span className="survey-summary-value">{formatDate(latest)}</span>
            <span className="survey-summary-label">Latest Vote</span>
          </div>
        )}
      </div>

      <div className="survey-table-scroll">
        <table className="survey-table">
          <thead>
            <tr>
              <th>Respondent</th>
              <th>Rating</th>
              {anyTags && <th>Tags</th>}
              <th>Voted</th>
            </tr>
          </thead>
          <tbody>
            {data.responses.map((r, i) => (
              <tr key={i}>
                <td className="survey-row-name">{r.Email}</td>
                <td>
                  <span
                    className="survey-rating-badge"
                    style={{
                      background:
                        r.Rating >= 7 ? "var(--accent)" :
                        r.Rating >= 5 ? "#E07A30" : "#C0392B",
                    }}
                  >
                    {r.Rating}
                  </span>
                </td>
                {anyTags && (
                  <td>
                    {Array.isArray(r.Tags) && r.Tags.length > 0
                      ? r.Tags.join(", ")
                      : <span className="contacts-zero">—</span>}
                  </td>
                )}
                <td className="contacts-date">{formatDate(r._receivedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TagBreakdownCard byTag={data.byTag} />
    </div>
  );
}

function AggregateView({ data }) {
  const max = Math.max(1, ...data.distribution.map((d) => d.votes));
  return (
    <div className="survey-table-wrap">
      <div className="survey-summary-row">
        <div className="survey-summary-card">
          <span className="survey-summary-value">{data.totalVotes}</span>
          <span className="survey-summary-label">Total Votes</span>
        </div>
        <div className="survey-summary-card">
          <span className="survey-summary-value">{data.avgRating.toFixed(1)}</span>
          <span className="survey-summary-label">Avg Score (out of 10)</span>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Rating distribution</h3>
        <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 60px", gap: 8, alignItems: "center" }}>
          {data.distribution.map((d) => (
            <div key={d.rating} style={{ display: "contents" }}>
              <div style={{ fontWeight: 600, textAlign: "right" }}>{d.rating}</div>
              <div style={{ background: "#f1f2f4", borderRadius: 4, height: 20, position: "relative" }}>
                <div
                  style={{
                    width: `${(d.votes / max) * 100}%`,
                    height: "100%",
                    background: "var(--accent)",
                    borderRadius: 4,
                    transition: "width 300ms",
                  }}
                />
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{d.votes}</div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 20, color: "var(--text-secondary)", fontSize: 12 }}>
          Mailchimp polls are anonymous — individual respondents are not attributed.
        </p>
      </div>
    </div>
  );
}

export default function EmailSatisfactionView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/surveys/email-satisfaction")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="state-message">Loading poll results from Mailchimp…</div>;
  if (error) return <div className="state-message">Error: {error}</div>;
  if (!data) return null;

  if (data.shape === "none") {
    return (
      <div className="survey-empty">
        <p className="survey-empty-title">No survey results yet</p>
        <p className="survey-empty-sub">{data.message}</p>
      </div>
    );
  }

  return (
    <>
      {data.survey && (
        <p className="page-subtitle" style={{ marginBottom: 8 }}>
          From: <strong>{data.survey.title}</strong>
          {data.survey.publishedAt && (
            <> &middot; published {formatDate(data.survey.publishedAt)}</>
          )}
        </p>
      )}
      {data.question?.query && (
        <p style={{ marginBottom: 16, fontStyle: "italic", color: "var(--text-secondary)" }}>
          “{data.question.query}”
        </p>
      )}
      {data.shape === "per-recipient" ? (
        <PerRecipientTable data={data} />
      ) : (
        <AggregateView data={data} />
      )}
    </>
  );
}
