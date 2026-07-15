import { NextResponse } from "next/server";
import { listRepTrainingCampaigns, getCampaignReport } from "../../../../lib/mailchimp";

const BENCHMARK_OPEN_RATE = parseFloat(process.env.BENCHMARK_OPEN_RATE || "0.26");
const BENCHMARK_CLICK_RATE = parseFloat(process.env.BENCHMARK_CLICK_RATE || "0.03");

// Fetch reports in small batches to stay well under Mailchimp's rate limit.
async function batchReports(ids, batchSize = 5) {
  const results = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (id) => {
        try {
          return { id, report: await getCampaignReport(id) };
        } catch {
          return { id, report: null };
        }
      })
    );
    results.push(...batchResults);
  }
  return results;
}

export async function GET() {
  try {
    const campaigns = await listRepTrainingCampaigns();
    // Cap at 30 most recent for performance; list is already sorted DESC by send_time.
    const recent = campaigns.slice(0, 30);

    const reportResults = await batchReports(recent.map((c) => c.id));

    const sends = recent
      .map((campaign) => {
        const found = reportResults.find((r) => r.id === campaign.id);
        const report = found?.report;
        if (!report) return null;

        const sent = report.emails_sent || 0;
        const hardBounces = report.bounces?.hard_bounces || 0;
        const softBounces = report.bounces?.soft_bounces || 0;
        const syntaxErrors = report.bounces?.syntax_errors || 0;
        const totalBounces = hardBounces + softBounces + syntaxErrors;
        const delivered = sent - totalBounces;
        const uniqueOpens = report.opens?.unique_opens || 0;
        const uniqueClicks = report.clicks?.unique_clicks || 0;
        const openRate = report.opens?.open_rate || 0;
        const clickRate = report.clicks?.click_rate || 0;
        const ctor = uniqueOpens > 0 ? uniqueClicks / uniqueOpens : 0;

        return {
          id: campaign.id,
          title: campaign.title,
          sendTime: campaign.sendTime,
          sent,
          delivered,
          uniqueOpens,
          uniqueClicks,
          openRate,
          clickRate,
          clickToOpenRate: ctor,
          bounces: totalBounces,
          unsubscribes: report.unsubscribes || 0,
        };
      })
      .filter(Boolean)
      // Ascending by date so charts render left→right chronologically.
      .sort((a, b) => new Date(a.sendTime) - new Date(b.sendTime));

    // Rolling 3-send average — null for the first two data points.
    const WINDOW = 3;
    const sendsWithRolling = sends.map((send, idx) => {
      if (idx < WINDOW - 1) {
        return { ...send, rollingOpenRate: null, rollingClickRate: null };
      }
      const window = sends.slice(idx - WINDOW + 1, idx + 1);
      const rollingOpenRate = window.reduce((s, r) => s + r.openRate, 0) / WINDOW;
      const rollingClickRate = window.reduce((s, r) => s + r.clickRate, 0) / WINDOW;
      return { ...send, rollingOpenRate, rollingClickRate };
    });

    return NextResponse.json({
      sends: sendsWithRolling,
      benchmarks: { openRate: BENCHMARK_OPEN_RATE, clickRate: BENCHMARK_CLICK_RATE },
      total: sendsWithRolling.length,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch trends data" },
      { status: 500 }
    );
  }
}
