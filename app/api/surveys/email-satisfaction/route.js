import { NextResponse } from "next/server";
import { listRepTrainingCampaigns, getCampaignPollResults } from "../../../../lib/mailchimp";

// Mailchimp campaign polls surface here as "survey responses".
//
// Response shape, discriminated by `shape`:
//   { shape: "per-recipient", campaign: {...}, pollId, responses: [...], total }
//   { shape: "aggregate",     campaign: {...}, pollId, distribution, totalVotes, avgRating }
//   { shape: "none",          message, scanned: N }   when no recent campaign had a poll
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const campaignIdParam = searchParams.get("campaignId");

  try {
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
