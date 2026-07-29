import CalendarView from "../components/CalendarView";

export const metadata = { title: "Home | Marketing Command Center" };

export default function HomePage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Events &amp; Calendar</h1>
        <p className="page-subtitle">Industry events, trade shows, and marketing plans</p>
      </div>
      <CalendarView />
    </div>
  );
}
