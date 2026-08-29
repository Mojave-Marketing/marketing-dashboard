// Server-side only. Never import this from a Client Component.

import { cacheGet, cacheSet } from "./cache";

const TTL = {
  profiles: 15 * 60 * 1000,  // 15 min
  posts:    15 * 60 * 1000,  // 15 min
};

function getAccessToken() {
  const token = process.env.BUFFER_API;
  if (!token) throw new Error("Missing BUFFER_API environment variable.");
  return token;
}

async function bufferFetch(path, params = {}) {
  const token = getAccessToken();
  const url = new URL(`https://api.bufferapp.com/1${path}`);
  url.searchParams.set("access_token", token);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Buffer API error ${res.status} for ${path}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function getLinkedInProfile() {
  const cacheKey = "buffer:linkedin-profile";
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const profiles = await bufferFetch("/profiles.json");
  const list = Array.isArray(profiles) ? profiles : [];
  const linkedin = list.find(
    (p) => p.service === "linkedin" || p.service === "linkedin-business"
  );

  if (!linkedin) return null;

  const result = {
    id: linkedin.id,
    name: linkedin.service_username || linkedin.formatted_username || "LinkedIn",
    followers: linkedin.statistics?.followers ?? null,
  };

  cacheSet(cacheKey, result, TTL.profiles);
  return result;
}

async function getLinkedInPosts(profileId, count = 25) {
  const cacheKey = `buffer:linkedin-posts:${profileId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const data = await bufferFetch(`/profiles/${profileId}/updates/sent.json`, { count });
  const updates = Array.isArray(data) ? data : (data.updates || []);

  const posts = updates.map((u) => ({
    id: u.id,
    text: u.text || "",
    sentAt: u.sent_at ? new Date(u.sent_at * 1000).toISOString() : null,
    stats: {
      impressions: u.statistics?.reach ?? 0,
      clicks:      u.statistics?.clicks ?? 0,
      reactions:   u.statistics?.favorites ?? 0,
      comments:    u.statistics?.comments ?? 0,
      shares:      u.statistics?.retweets ?? 0,
    },
  }));

  cacheSet(cacheKey, posts, TTL.posts);
  return posts;
}

export { getLinkedInProfile, getLinkedInPosts };
