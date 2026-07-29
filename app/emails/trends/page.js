import TrendsView from "../../../components/TrendsView";

export const metadata = { title: "Trends & Baseline | Marketing Command Center" };

export default function TrendsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Trends &amp; Baseline</h1>
        <p className="page-subtitle">Open rate, click rate, and rolling baseline across all sends</p>
      </div>
      <TrendsView />
    </div>
  );
}
