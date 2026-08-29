"use client";

import { useState, useMemo } from "react";

const PAGE_SIZE = 25;

export default function ContactsCard({ contacts = [] }) {
  const [filter, setFilter] = useState("all"); // "all" | "opened" | "clicked"
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let list = contacts;
    if (filter === "opened") list = list.filter((c) => c.opens > 0);
    if (filter === "clicked") list = list.filter((c) => c.clicks > 0);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.email.toLowerCase().includes(q));
    }
    return list;
  }, [contacts, filter, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const slice = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const openedCount = contacts.filter((c) => c.opens > 0).length;
  const clickedCount = contacts.filter((c) => c.clicks > 0).length;

  function handleFilter(f) {
    setFilter(f);
    setPage(0);
  }

  function handleSearch(e) {
    setSearch(e.target.value);
    setPage(0);
  }

  return (
    <div className="card contacts-card">
      <div className="contacts-header">
        <div>
          <h3 className="contacts-title">Contact Activity</h3>
          <p className="contacts-subtitle">{contacts.length} contacts received this campaign</p>
        </div>
        <input
          className="contacts-search"
          type="text"
          placeholder="Search by email…"
          value={search}
          onChange={handleSearch}
        />
      </div>

      <div className="contacts-filters">
        <button
          className={`contacts-filter-btn${filter === "all" ? " active" : ""}`}
          onClick={() => handleFilter("all")}
        >
          All <span className="contacts-filter-count">{contacts.length}</span>
        </button>
        <button
          className={`contacts-filter-btn${filter === "opened" ? " active" : ""}`}
          onClick={() => handleFilter("opened")}
        >
          Opened <span className="contacts-filter-count">{openedCount}</span>
        </button>
        <button
          className={`contacts-filter-btn${filter === "clicked" ? " active" : ""}`}
          onClick={() => handleFilter("clicked")}
        >
          Clicked <span className="contacts-filter-count">{clickedCount}</span>
        </button>
      </div>

      {slice.length === 0 ? (
        <div className="contacts-empty">No contacts match this filter.</div>
      ) : (
        <>
          <table className="contacts-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Opens</th>
                <th>Clicks</th>
                <th>Last Active</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((c) => (
                <tr key={c.email}>
                  <td className="contacts-email">{c.email}</td>
                  <td>{c.opens > 0 ? c.opens : <span className="contacts-zero">—</span>}</td>
                  <td>{c.clicks > 0 ? c.clicks : <span className="contacts-zero">—</span>}</td>
                  <td className="contacts-date">
                    {new Date(c.lastActive).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="contacts-pagination">
              <button
                className="contacts-page-btn"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                ‹ Prev
              </button>
              <span className="contacts-page-info">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <button
                className="contacts-page-btn"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
