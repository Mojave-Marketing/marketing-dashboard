import ComingSoon from "../../../components/ComingSoon";

export const metadata = { title: "Website Analytics | Marketing Command Center" };

export default function WebsiteAnalyticsPage() {
  return (
    <div className="page">
      <ComingSoon
        title="Website Analytics"
        description="Sessions, users, pageviews, bounce rate, top pages, and traffic sources — pulled directly from Google Analytics so you never have to leave the dashboard."
      />
    </div>
  );
}
