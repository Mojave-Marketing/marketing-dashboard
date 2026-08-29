import LinkedInView from "../../../components/LinkedInView";

export const metadata = { title: "LinkedIn Analytics | Marketing Command Center" };

export default function LinkedInAnalyticsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">LinkedIn Analytics</h1>
        <p className="page-subtitle">Post performance and engagement sourced from Buffer</p>
      </div>
      <LinkedInView />
    </div>
  );
}
