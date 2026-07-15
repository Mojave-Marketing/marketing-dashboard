import { NextResponse } from "next/server";
import { listRepTrainingCampaigns } from "../../../lib/mailchimp";

export async function GET() {
  try {
    const campaigns = await listRepTrainingCampaigns();
    return NextResponse.json({ campaigns });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}
