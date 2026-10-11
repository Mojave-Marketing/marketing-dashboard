import EmailSatisfactionView from "../../../components/EmailSatisfactionView";

export const metadata = { title: "Mailchimp NPS Survey | Marketing Command Center" };

export default function EmailSatisfactionPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Mailchimp NPS Survey</h1>
        <p className="page-subtitle">1–10 satisfaction ratings from Mailchimp survey responses</p>
      </div>
      <EmailSatisfactionView />
    </div>
  );
}
