import { NextResponse } from "next/server";
import {
  getCampaignReport,
  getCampaignClickDetails,
  getCampaignEmailActivity,
} from "../../../../lib/mailchimp";

const BENCHMARK_OPEN_RATE = parseFloat(process.env.BENCHMARK_OPEN_RATE || "0.26");
const BENCHMARK_CLICK_RATE = parseFloat(process.env.BENCHMARK_CLICK_RATE || "0.03");

function pct(n) {
  return Math.round(n * 1000) / 10; // one decimal place, as a percentage number
}

function bucketOpens(emailActivity) {
  // Buckets: 0, 1, 2, 3, 4-5, 6-10, 11+
  const buckets = { "0": 0, "1": 0, "2": 0, "3": 0, "4-5": 0, "6-10": 0, "11+": 0 };
  for (const member of emailActivity) {
    const opens = (member.activity || []).filter((a) => a.action === "open").length;
    if (opens === 0) buckets["0"]++;
    else if (opens === 1) buckets["1"]++;
    else if (opens === 2) buckets["2"]++;
    else if (opens === 3) buckets["3"]++;
    else if (opens <= 5) buckets["4-5"]++;
    else if (opens <= 10) buckets["6-10"]++;
    else buckets["11+"]++;
  }
  return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
}

function findHighOpenNoClick(emailActivity, minOpens = 5) {
  return emailActivity.filter((member) => {
    const acts = member.activity || [];
    const opens = acts.filter((a) => a.action === "open").length;
    const clicks = acts.filter((a) => a.action === "click").length;
    return opens >= minOpens && clicks === 0;
  });
}

function generateTakeaways({ report, engagementBuckets, topLinks, highOpenNoClick, emailActivity }) {
  const takeaways = [];
  const sent = report.emails_sent || 0;
  const openRate = report.opens?.open_rate ?? 0;
  const clickRate = report.clicks?.click_rate ?? 0;
  const uniqueOpens = report.opens?.unique_opens ?? 0;

  // 1. Open rate vs benchmark
  const openDelta = pct(openRate - BENCHMARK_OPEN_RATE);
  takeaways.push({
    title: "Open rate vs. benchmark",
    body: `This send had a ${pct(openRate)}% open rate (${uniqueOpens} of ${sent} recipients), which is ${
      openDelta >= 0 ? `${openDelta} points above` : `${Math.abs(openDelta)} points below`
    } the ${pct(BENCHMARK_OPEN_RATE)}% training/education benchmark. ${
      openDelta >= 0
        ? "Test a follow-up resend to non-openers within a week to capture more of this good starting engagement."
        : "Test a punchier subject line or an earlier/different send time on the next send to lift opens."
    }`,
  });

  // 2. Click-to-open / click rate
  const ctor = uniqueOpens > 0 ? (report.clicks?.unique_clicks ?? 0) / uniqueOpens : 0;
  takeaways.push({
    title: "Click-through performance",
    body: `Click rate landed at ${pct(clickRate)}% versus the ${pct(BENCHMARK_CLICK_RATE)}% benchmark, with a click-to-open rate of ${pct(
      ctor
    )}%. ${
      clickRate < BENCHMARK_CLICK_RATE
        ? "Test moving the primary CTA higher in the email or making it a distinct button rather than a text link."
        : "This is a strong click rate — test replicating this email's CTA placement in the next send."
    }`,
  });

  // 3. Non-openers
  const neverOpened = sent - uniqueOpens;
  const neverOpenedPct = sent > 0 ? pct(neverOpened / sent) : 0;
  takeaways.push({
    title: "Reach the non-openers",
    body: `${neverOpened} recipients (${neverOpenedPct}% of the send) never opened this email. Test a resend to this specific non-opener segment with a different subject line — this is usually the single highest-leverage change available after a send.`,
  });

  // 4. High-open, zero-click reps
  if (highOpenNoClick.length > 0) {
    takeaways.push({
      title: "Engaged but not converting",
      body: `${highOpenNoClick.length} recipients opened this email 5+ times but never clicked a link. High repeat-opens with no clicks usually means the CTA isn't standing out or isn't compelling enough. Test a stronger, single, above-the-fold CTA aimed specifically at this group.`,
    });
  }

  // 5. Top link / dead links
  if (topLinks && topLinks.length > 0) {
    const sorted = [...topLinks].sort((a, b) => b.total_clicks - a.total_clicks);
    const top = sorted[0];
    const dead = sorted.filter((l) => l.total_clicks === 0);
    const totalClicks = sorted.reduce((s, l) => s + l.total_clicks, 0);
    const topShare = totalClicks > 0 ? pct(top.total_clicks / totalClicks) : 0;
    let body = `"${top.url}" took ${top.total_clicks} of ${totalClicks} total clicks (${topShare}%), making it the dominant link in this email.`;
    if (dead.length > 0) {
      body += ` ${dead.length} link${dead.length > 1 ? "s" : ""} in the email got zero clicks — test removing unused links to simplify the email and concentrate attention on what works.`;
    }
    takeaways.push({ title: "Where the clicks went", body });
  }

  // 6. Engagement depth
  const repeatOpeners = engagementBuckets
    .filter((b) => !["0", "1"].includes(b.bucket))
    .reduce((s, b) => s + b.count, 0);
  if (uniqueOpens > 0) {
    takeaways.push({
      title: "Engagement depth",
      body: `${repeatOpeners} recipients (${pct(repeatOpeners / sent)}% of the send) opened this email 2+ times. Repeat opens often signal the email is being referenced or forwarded internally — test adding a clear "save this" or reference-friendly summary near the top for this audience.`,
    });
  }

  return takeaways;
}

export async function GET(request, { params }) {
  const { id } = params;

  try {
    const [report, topLinks, emailActivity] = await Promise.all([
      getCampaignReport(id),
      getCampaignClickDetails(id).catch(() => []),
      getCampaignEmailActivity(id).catch(() => []),
    ]);

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
    const unsubscribed = report.unsubscribes || 0;

    const kpis = {
      sent,
      delivered,
      openRate,
      clickRate,
      clickToOpenRate: ctor,
      bounces: totalBounces,
      unsubscribed,
      benchmarks: {
        openRate: BENCHMARK_OPEN_RATE,
        clickRate: BENCHMARK_CLICK_RATE,
      },
    };

    const funnel = [
      { stage: "Sent", value: sent },
      { stage: "Delivered", value: delivered },
      { stage: "Opened", value: uniqueOpens },
      { stage: "Clicked", value: uniqueClicks },
    ];

    const engagementBuckets = bucketOpens(emailActivity);
    const highOpenNoClick = findHighOpenNoClick(emailActivity);

    const takeaways = generateTakeaways({
      report,
      engagementBuckets,
      topLinks,
      highOpenNoClick,
      emailActivity,
    });

    return NextResponse.json({
      campaignId: id,
      title: report.settings?.title || report.campaign_title || "(untitled)",
      sendTime: report.send_time,
      kpis,
      funnel,
      engagementBuckets,
      topLinks: (topLinks || [])
        .sort((a, b) => b.total_clicks - a.total_clicks)
        .slice(0, 10)
        .map((l) => ({ url: l.url, clicks: l.total_clicks, uniqueClicks: l.unique_clicks })),
      takeaways,
      recipientCountFromActivity: emailActivity.length,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch campaign report" },
      { status: 500 }
    );
  }
}
