"use client";

import { useEffect, useState } from "react";
import KpiCard from "../../components/KpiCard";
import FunnelChartCard from "../../components/FunnelChartCard";
import EngagementDepthChartCard from "../../components/EngagementDepthChartCard";
import TopLinksCard from "../../components/TopLinksCard";
import ContactsCard from "../../components/ContactsCard";

export default function CampaignPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/campaigns")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setCampaigns(data.campaigns || []);
        if (data.campaigns?.length > 0) setSelectedId(data.campaigns[0].id);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingDetail(true);
    setError(null);
    fetch(`/api/campaigns/${selectedId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setDetail(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  if (loadingList) return <div className="page"><div className="state-message">Loading campaigns from Mailchimp…</div></div>;

  if (error) {
    return (
      <div className="page">
        <div className="state-message">
          <strong>Couldn&apos;t load data:</strong> {error}
          <br />
          Check that MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX, and your filter
          settings are configured correctly in your environment variables.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{detail ? detail.title : "Campaign"}</h1>
        {detail && <p className="page-subtitle">Sent {new Date(detail.sendTime).toLocaleDateString()}</p>}
      </div>

      {campaigns.length === 0 ? (
        <div className="state-message">
          No matching campaigns found. Check your MAILCHIMP_FILTER_MODE /
          MAILCHIMP_TITLE_MATCH (or MAILCHIMP_FOLDER_ID) settings.
        </div>
      ) : (
        <>
          <div className="page-controls">
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({new Date(c.sendTime).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          {loadingDetail || !detail ? (
            <div className="state-message">Loading campaign report…</div>
          ) : (
            <>
              <div className="kpi-grid">
                <KpiCard label="Sent" value={detail.kpis.sent} />
                <KpiCard label="Delivered" value={detail.kpis.delivered} />
                <KpiCard label="Open rate" value={detail.kpis.openRate} format="percent" benchmark={detail.kpis.benchmarks.openRate} />
                <KpiCard label="Click rate" value={detail.kpis.clickRate} format="percent" benchmark={detail.kpis.benchmarks.clickRate} />
                <KpiCard label="Bounces" value={detail.kpis.bounces} />
                <KpiCard label="Unsubscribes" value={detail.kpis.unsubscribed} />
              </div>

              <div className="charts-grid">
                <FunnelChartCard data={detail.funnel} />
                <EngagementDepthChartCard data={detail.engagementBuckets} />
                <TopLinksCard links={detail.topLinks} />
              </div>

              <ContactsCard contacts={detail.contacts || []} />

              <div className="footer-note">
                Data pulled live from Mailchimp&apos;s Reports API. Engagement-depth buckets are
                derived from {detail.recipientCountFromActivity} per-recipient activity records
                returned for this campaign.
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
