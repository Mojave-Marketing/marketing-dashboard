import { NextResponse } from "next/server";
import { getLinkedInProfile, getLinkedInPosts } from "../../../lib/buffer";

export async function GET() {
  if (!process.env.BUFFER_API) {
    return NextResponse.json({ error: "BUFFER_API not configured" }, { status: 404 });
  }

  try {
    const profile = await getLinkedInProfile();
    if (!profile) {
      return NextResponse.json(
        { error: "No LinkedIn profile found in Buffer. Make sure a LinkedIn account is connected." },
        { status: 404 }
      );
    }

    const posts = await getLinkedInPosts(profile.id, 25);

    const postsWithEngagement = posts.map((p) => {
      const { impressions, clicks, reactions, comments, shares } = p.stats;
      const totalEngagements = reactions + comments + shares + clicks;
      const engagementRate = impressions > 0 ? totalEngagements / impressions : 0;
      return { ...p, stats: { ...p.stats, engagementRate } };
    });

    const analyzed = postsWithEngagement.filter((p) => p.stats.impressions > 0);

    const summary = {
      postsAnalyzed: analyzed.length,
      totalPostsFetched: posts.length,
      avgImpressions:
        analyzed.length > 0
          ? Math.round(analyzed.reduce((s, p) => s + p.stats.impressions, 0) / analyzed.length)
          : 0,
      totalClicks: posts.reduce((s, p) => s + p.stats.clicks, 0),
      avgEngagementRate:
        analyzed.length > 0
          ? analyzed.reduce((s, p) => s + p.stats.engagementRate, 0) / analyzed.length
          : 0,
    };

    return NextResponse.json({
      profile: { name: profile.name, followers: profile.followers },
      posts: postsWithEngagement,
      summary,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch LinkedIn data from Buffer" },
      { status: 500 }
    );
  }
}
