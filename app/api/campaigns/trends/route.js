import { NextResponse } from "next/server";
import { listRepTrainingCampaigns, getCampaignReport } from "../../../../lib/mailchimp";

function pct(v) {
  return Math.round(v * 1000) / 10;
}

function generateTrendTakeaways(sends, benchmarks) {
  if (sends.length < 2) return [];
  const takeaways = [];
  const n = sends.length;
  const avgOpen = sends.reduce((s, x) => s + x.openRate, 0) / n;
  const avgClick = sends.reduce((s, x) => s + x.clickRate, 0) / n;
  const avgCtor = sends.reduce((s, x) => s + x.clickToOpenRate, 0) / n;
  const avgSent = sends.reduce((s, x) => s + x.sent, 0) / n;
  const avgUniqueOpens = sends.reduce((s, x) => s + x.uniqueOpens, 0) / n;

  // 1. Trend direction — last-3 vs first-3 open rate
  if (n >= 6) {
    const recent3 = sends.slice(-3).reduce((s, x) => s + x.openRate, 0) / 3;
    const first3 = sends.slice(0, 3).reduce((s, x) => s + x.openRate, 0) / 3;
    const delta = recent3 - first3;
    takeaways.push({
      title: "Open rate momentum",
      body: `Comparing the most recent 3 sends (avg ${pct(recent3)}%) against the oldest 3 analyzed (avg ${pct(first3)}%), open rate has ${delta >= 0 ? `climbed ${pct(Math.abs(delta))} points` : `declined ${pct(Math.abs(delta))} points`}. ${delta >= 0 ? "Momentum is positive — keep the current approach and test incremental variations rather than overhauling the format." : "Test refreshing the subject line strategy or shifting send day/time to reverse the slide."}`,
    });
  }

  // 2. Benchmark hit rate
  const beatOpen = sends.filter((s) => s.openRate >= benchmarks.openRate).length;
  const beatClick = sends.filter((s) => s.clickRate >= benchmarks.clickRate).length;
  takeaways.push({
    title: "Benchmark hit rate",
    body: `Of the last ${n} sends, ${beatOpen} (${Math.round((beatOpen / n) * 100)}%) exceeded the ${pct(benchmarks.openRate)}% open rate benchmark and ${beatClick} (${Math.round((beatClick / n) * 100)}%) cleared the ${pct(benchmarks.clickRate)}% click rate benchmark. ${beatOpen / n >= 0.5 ? "Open rates are consistently competitive — focus optimization energy on click rates to push CTOR higher." : "Open rates are under benchmark more often than not — treat subject line experimentation as a systematic practice across every send."}`,
  });

  // 3. Best vs. worst
  const bestOpen = sends.reduce((b, s) => (s.openRate > b.openRate ? s : b), sends[0]);
  const worstOpen = sends.reduce((b, s) => (s.openRate < b.openRate ? s : b), sends[0]);
  takeaways.push({
    title: "Best vs. worst send",
    body: `The highest-performing send was "${bestOpen.title}" on ${new Date(bestOpen.sendTime).toLocaleDateString()} at ${pct(bestOpen.openRate)}% open rate. The lowest was "${worstOpen.title}" at ${pct(worstOpen.openRate)}%. The ${pct(bestOpen.openRate - worstOpen.openRate)}-point gap is worth studying — compare subject lines, send times, and topics between these two campaigns to find the variables that drove the difference.`,
  });

  // 4. CTOR health
  takeaways.push({
    title: "Click-to-open efficiency",
    body: `Average CTOR across these ${n} sends is ${pct(avgCtor)}%. ${avgCtor >= 0.1 ? "When recipients open, they click at a solid rate — the bigger opportunity is getting more people to open in the first place." : "Openers aren't converting to clickers at a strong rate. Test a single, high-contrast CTA button placed above the fold on the next send and compare CTOR against this baseline."}`,
  });

  // 5. Audience consistency (open rate variance)
  const variance = sends.reduce((s, x) => s + Math.pow(x.openRate - avgOpen, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  const minOpen = sends.reduce((b, s) => Math.min(b, s.openRate), sends[0].openRate);
  const maxOpen = sends.reduce((b, s) => Math.max(b, s.openRate), sends[0].openRate);
  takeaways.push({
    title: "Audience consistency",
    body: `Open rate ranged from ${pct(minOpen)}% to ${pct(maxOpen)}% with a standard deviation of ${pct(stdDev)} points. ${stdDev <= 0.05 ? "This is a consistent, predictable audience — list hygiene looks healthy and content is resonating steadily." : "High variability suggests performance swings with campaign topic or timing rather than list quality. Standardize your send day and time to isolate content as the key variable."}`,
  });

  // 6. Non-opener resend opportunity
  const avgNonOpeners = avgSent - avgUniqueOpens;
  takeaways.push({
    title: "Resend opportunity",
    body: `On average, ${Math.round(avgNonOpeners).toLocaleString()} recipients (${pct(avgNonOpeners / avgSent)}% of each send) never open. A systematic resend-to-non-openers program — different subject line, 48–72 hours after each send — is typically the highest-leverage, lowest-effort tactic available and could materially increase total reach without growing the list.`,
  });

  return takeaways;
}

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

export const _internals = { generateTrendTakeaways, batchReports };

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

    const takeaways = generateTrendTakeaways(sendsWithRolling, {
      openRate: BENCHMARK_OPEN_RATE,
      clickRate: BENCHMARK_CLICK_RATE,
    });

    return NextResponse.json({
      sends: sendsWithRolling,
      benchmarks: { openRate: BENCHMARK_OPEN_RATE, clickRate: BENCHMARK_CLICK_RATE },
      total: sendsWithRolling.length,
      takeaways,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch trends data" },
      { status: 500 }
    );
  }
}
