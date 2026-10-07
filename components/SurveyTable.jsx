"use client";

import { useEffect, useState } from "react";

function detectName(row) {
  const nameKey = Object.keys(row).find(
    (k) => !k.startsWith("_") && k.toLowerCase().includes("name")
  );
  return nameKey ? row[nameKey] : null;
}

function detectPrimaryRating(row) {
  return Object.entries(row).find(([k, v]) => {
    if (k.startsWith("_")) return false;
    const n = Number(String(v).trim());
    return Number.isInteger(n) && n >= 1 && n <= 10;
  }) || null;
}

function RatingBadge({ value, max }) {
  const n = Number(value);
  const pct = n / max;
  const color = pct >= 0.7 ? "var(--accent)" : pct >= 0.5 ? "#E07A30" : "#C0392B";
  return (
    <span className="survey-rating-badge" style={{ background: color }}>
      {value}
    </span>
  );
}

function ResponseRow({ row, index }) {
  const [open, setOpen] = useState(false);

  const name = detectName(row);
  const primaryRating = detectPrimaryRating(row);
  const ratingMax = primaryRating && Number(primaryRating[1]) > 5 ? 10 : 5;
  const date = new Date(row._receivedAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  const detailFields = Object.entries(row).filter(([k]) => !k.startsWith("_"));

  return (
    <>
      <tr
        className={`survey-row${open ? " survey-row--open" : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        <td className="survey-row-toggle">{open ? "▾" : "▸"}</td>
        <td className="survey-row-name">
          {name || <span className="contacts-zero">Anonymous</span>}
        </td>
        <td className="survey-row-ratings">
          {primaryRating
            ? <RatingBadge value={primaryRating[1]} max={ratingMax} />
            : <span className="contacts-zero">—</span>}
        </td>
        <td className="contacts-date">{date}</td>
      </tr>
      {open && (
        <tr className="survey-detail-row">
          <td colSpan={4}>
            <div className="survey-detail-grid">
              {detailFields.map(([k, v]) => (
                <div key={k} className="survey-detail-item">
                  <span className="survey-detail-question">
                    {k.replace(/_/g, " ")}
                  </span>
                  <span className="survey-detail-answer">{v || "—"}</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function SurveyTable({ formId }) {
  const [responses, setResponses] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unconfigured, setUnconfigured] = useState(false);

  useEffect(() => {
    fetch(`/api/surveys/${formId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setResponses(d.responses || []);
        setTotal(d.total || 0);
        setUnconfigured(!!d.unconfigured);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [formId]);

  if (loading) return <div className="state-message">Loading responses…</div>;

  if (unconfigured) {
    return (
      <div className="state-message">
        Blob storage is not configured. Add <code>BLOB_READ_WRITE_TOKEN</code> to your
        environment variables to enable survey response storage.
      </div>
    );
  }

  if (error) return <div className="state-message">Error: {error}</div>;

  if (responses.length === 0) {
    return (
      <div className="survey-empty">
        <p className="survey-empty-title">No responses yet</p>
        <p className="survey-empty-sub">
          Responses will appear here as they come in through Zapier.
        </p>
      </div>
    );
  }

  const latestDate = new Date(responses[0]._receivedAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  const primaryRatings = responses
    .map((r) => detectPrimaryRating(r))
    .filter(Boolean)
    .map(([, v]) => Number(v));
  const ratingMax = primaryRatings.some((v) => v > 5) ? 10 : 5;
  const avgScore = primaryRatings.length
    ? (primaryRatings.reduce((a, b) => a + b, 0) / primaryRatings.length).toFixed(1)
    : null;

  return (
    <div className="survey-table-wrap">
      <div className="survey-summary-row">
        <div className="survey-summary-card">
          <span className="survey-summary-value">{total}</span>
          <span className="survey-summary-label">Total Responses</span>
        </div>
        {avgScore && (
          <div className="survey-summary-card">
            <span className="survey-summary-value">{avgScore}</span>
            <span className="survey-summary-label">Avg Score (out of {ratingMax})</span>
          </div>
        )}
        <div className="survey-summary-card">
          <span className="survey-summary-value">{latestDate}</span>
          <span className="survey-summary-label">Latest Submission</span>
        </div>
      </div>

      <div className="survey-table-scroll">
        <table className="survey-table">
          <thead>
            <tr>
              <th style={{ width: 32 }} />
              <th>Respondent</th>
              <th>Ratings</th>
              <th>Received</th>
            </tr>
          </thead>
          <tbody>
            {responses.map((row, i) => (
              <ResponseRow key={i} row={row} index={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
