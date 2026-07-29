"use client";

import { useEffect, useState } from "react";

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

  // Derive columns from all responses (handles evolving form fields)
  const columns = [
    ...new Set(responses.flatMap((r) => Object.keys(r))),
  ].filter((k) => !k.startsWith("_"));

  return (
    <div className="survey-table-wrap">
      <p className="survey-count">{total} response{total !== 1 ? "s" : ""}</p>
      <div className="survey-table-scroll">
        <table className="survey-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{col.replace(/_/g, " ")}</th>
              ))}
              <th>Received</th>
            </tr>
          </thead>
          <tbody>
            {responses.map((row, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col}>{row[col] ?? <span className="contacts-zero">—</span>}</td>
                ))}
                <td className="contacts-date">
                  {new Date(row._receivedAt).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
