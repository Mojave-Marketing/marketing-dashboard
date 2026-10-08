import EmailSatisfactionView from "../../../components/EmailSatisfactionView";

export const metadata = { title: "Email Satisfaction | Marketing Command Center" };

export default function EmailSatisfactionPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Email Satisfaction</h1>
        <p className="page-subtitle">1–10 ratings from Mailchimp email polls</p>
      </div>
      <EmailSatisfactionView />
    </div>
  );
}
