import { NextResponse } from "next/server";
import {
  listRepTrainingCampaigns,
  getCampaignPollResults,
  getCampaignClickDetails,
} from "../../../../lib/mailchimp";

// Mailchimp campaign polls surface here as "survey responses".
//
// Response shape, discriminated by `shape`:
//   { shape: "per-recipient", campaign: {...}, pollId, responses: [...], total }
//   { shape: "aggregate",     campaign: {...}, pollId, distribution, totalVotes, avgRating }
//   { shape: "none",          message, scanned: N }   when no recent campaign had a poll
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const campaignIdParam = searchParams.get("campaignId");
  const debug = searchParams.get("debug") === "1";

  try {
    // Debug: show what the detection sees so we can fix the regex when it misses.
    // Returns scanned campaign titles + sample click URLs per campaign.
    if (debug) {
      const campaigns = await listRepTrainingCampaigns();
      const scanLimit = Math.min(10, campaigns.length);
      const scanned = [];
      for (let i = 0; i < scanLimit; i++) {
        const c = campaigns[i];
        let urls = [];
        try {
          const links = await getCampaignClickDetails(c.id);
          urls = links.slice(0, 15).map((l) => l.url);
        } catch (err) {
          urls = [`<error: ${err.message}>`];
        }
        scanned.push({ id: c.id, title: c.title, sendTime: c.sendTime, urls });
      }
      return NextResponse.json({ debug: true, scanned });
    }

    // Deep probe: given a specific campaignId, fetch every plausible endpoint
    // for poll data so we can see where Mailchimp actually stores it.
    const probe = searchParams.get("probe");
    if (probe) {
      const result = { probe };
      const { apiKey, baseUrl } = (() => {
        const key = process.env.MAILCHIMP_API_KEY;
        const prefix = process.env.MAILCHIMP_SERVER_PREFIX;
        return { apiKey: key, baseUrl: `https://${prefix}.api.mailchimp.com/3.0` };
      })();
      const auth = "Basic " + Buffer.from(`anystring:${apiKey}`).toString("base64");

      // Probe each candidate endpoint; capture status + a trimmed body.
      // probe=<campaignId> drives the first set; the list_id is appended via
      // the ?listId=<id> query param so we can also hit the surveys endpoints.
      const listId = searchParams.get("listId");
      const endpoints = [
        `/reports/${probe}`,
        `/reports/${probe}/poll-activity`,
        `/reports/${probe}/polls`,
        `/reports/${probe}/email-activity?count=3`,
        `/campaigns/${probe}/content`,
        `/reporting/surveys`,
        `/reporting/surveys?count=10`,
        ...(listId ? [`/lists/${listId}/surveys`] : []),
      ];
      result.endpoints = await Promise.all(
        endpoints.map(async (path) => {
          try {
            const res = await fetch(`${baseUrl}${path}`, { headers: { Authorization: auth }, cache: "no-store" });
            const text = await res.text();
            return {
              path,
              status: res.status,
              bodyPreview: text.length > 4000 ? text.slice(0, 4000) + "\n...<truncated>" : text,
            };
          } catch (err) {
            return { path, error: err.message };
          }
        })
      );
      return NextResponse.json(result);
    }

    // Explicit campaign requested — try that one directly.
    if (campaignIdParam) {
      const campaigns = await listRepTrainingCampaigns();
      const campaign = campaigns.find((c) => c.id === campaignIdParam);
      const results = await getCampaignPollResults(campaignIdParam);
      if (!results) {
        return NextResponse.json({
          shape: "none",
          campaign: campaign || null,
          message: "No poll detected for this campaign.",
        });
      }
      return NextResponse.json({ ...results, campaign });
    }

    // Default: scan recent campaigns, newest first, and return the first poll
    // we find. Cap at the 10 most recent so we don't rate-limit on every GET.
    const campaigns = await listRepTrainingCampaigns();
    const scanLimit = Math.min(10, campaigns.length);
    for (let i = 0; i < scanLimit; i++) {
      const campaign = campaigns[i];
      const results = await getCampaignPollResults(campaign.id);
      if (results) {
        return NextResponse.json({ ...results, campaign });
      }
    }

    return NextResponse.json({
      shape: "none",
      scanned: scanLimit,
      message: `No poll found in the ${scanLimit} most recent campaigns.`,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Failed to load poll results" },
      { status: 500 }
    );
  }
}
