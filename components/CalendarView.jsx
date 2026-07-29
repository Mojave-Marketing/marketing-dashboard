"use client";

import { useState } from "react";

const EVENTS = [
  {
    id: 1,
    title: "Fall Marketing Push",
    start: "2026-09-01",
    end: "2026-09-30",
    type: "campaign",
    notes: "September awareness campaign. Target residential HVAC replacement ahead of the winter season. Goal: 3 sends throughout the month.",
  },
  {
    id: 2,
    title: "Holiday Campaign",
    start: "2026-12-01",
    end: "2026-12-15",
    type: "campaign",
    notes: "End-of-year email campaign. Focus on service contracts and maintenance plan renewals for the new year.",
  },
  {
    id: 3,
    title: "Pre-AHR Email Blast",
    start: "2027-01-10",
    end: "2027-01-10",
    type: "campaign",
    notes: "Announce Mojave presence at AHR Expo. Drive booth traffic and schedule meetings with key contacts in advance.",
  },
  {
    id: 4,
    title: "AHR Expo 2027",
    start: "2027-01-25",
    end: "2027-01-27",
    type: "trade-show",
    location: "Las Vegas, NV",
    notes: "International Air-Conditioning, Heating, Refrigerating Exposition — largest HVAC trade show in North America. Reserve hotel and booth space by October 2026.",
  },
  {
    id: 5,
    title: "ACCA Annual Conference",
    start: "2027-03-17",
    end: "2027-03-20",
    type: "trade-show",
    location: "Nashville, TN",
    notes: "Air Conditioning Contractors of America annual conference. Key networking opportunity. Consider sponsorship package.",
  },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateRange(event) {
  const start = parseDate(event.start);
  const end = parseDate(event.end);
  if (event.start === event.end) {
    return start.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }
  return (
    start.toLocaleDateString("en-US", { month: "long", day: "numeric" }) +
    " – " +
    end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  );
}

function getEventsForDay(year, month, day) {
  const date = new Date(year, month, day);
  return EVENTS.filter((e) => {
    const start = parseDate(e.start);
    const end = parseDate(e.end);
    return date >= start && date <= end;
  });
}

export default function CalendarView() {
  const today = new Date();
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(null);

  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="calendar-container">
      <div>
        <div className="calendar-header">
          <button
            className="calendar-nav-btn"
            onClick={() => { setCurrent(new Date(year, month - 1, 1)); setSelected(null); }}
          >
            ‹
          </button>
          <h2 className="calendar-month-label">{MONTH_NAMES[month]} {year}</h2>
          <button
            className="calendar-nav-btn"
            onClick={() => { setCurrent(new Date(year, month + 1, 1)); setSelected(null); }}
          >
            ›
          </button>
        </div>

        <div className="calendar-grid">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="calendar-day-header">{d}</div>
          ))}
          {cells.map((day, idx) => {
            if (!day) return <div key={`e-${idx}`} className="calendar-cell calendar-cell--empty" />;
            const events = getEventsForDay(year, month, day);
            const isToday =
              year === today.getFullYear() &&
              month === today.getMonth() &&
              day === today.getDate();
            return (
              <div key={day} className={`calendar-cell${isToday ? " calendar-cell--today" : ""}`}>
                <span className="day-num">{day}</span>
                {events.map((e) => (
                  <button
                    key={e.id}
                    className={`cal-event cal-event--${e.type}`}
                    onClick={() => setSelected(selected?.id === e.id ? null : e)}
                  >
                    {e.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="event-panel">
        {selected ? (
          <div className="event-detail card">
            <button className="event-detail-close" onClick={() => setSelected(null)}>×</button>
            <span className={`event-detail-type cal-event--${selected.type}`}>
              {selected.type === "trade-show" ? "Trade Show" : "Campaign"}
            </span>
            <h3>{selected.title}</h3>
            <p className="event-detail-dates">{formatDateRange(selected)}</p>
            {selected.location && (
              <p className="event-detail-location">{selected.location}</p>
            )}
            <p className="event-detail-notes-label">Plan Notes</p>
            <p className="event-detail-notes">{selected.notes}</p>
          </div>
        ) : (
          <div className="event-panel-empty card">
            <p>Select an event to see details and plan notes.</p>
          </div>
        )}
      </div>
    </div>
  );
}
