export const metadata = { title: "Runbook | Marketing Command Center" };

export default function RunbookPage() {
  return (
    <div className="runbook-page">
      <iframe
        src="/runbook.html"
        className="runbook-frame"
        title="Mojave Marketing Operations Runbook"
        sandbox="allow-same-origin allow-scripts"
      />
    </div>
  );
}
