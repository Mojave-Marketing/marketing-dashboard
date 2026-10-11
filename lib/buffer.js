// Server-side only. Never import this from a Client Component.
//
// Buffer's new GraphQL API (https://api.buffer.com). The legacy REST API
// (api.bufferapp.com/1/*) was deprecated and public API tokens are no
// longer accepted. Auth is now a personal API key generated at
// https://publish.buffer.com/settings/api and passed as a Bearer token.

import { cacheGet, cacheSet } from "./cache";

const TTL = {
  org:      30 * 60 * 1000,  // 30 min — org id rarely changes
  channel:  15 * 60 * 1000,
  posts:    15 * 60 * 1000,
};

const BUFFER_GRAPHQL_URL = "https://api.buffer.com";

function getAccessToken() {
  const token = process.env.BUFFER_API;
  if (!token) throw new Error("Missing BUFFER_API environment variable.");
  return token;
}

async function bufferGraphQL(query, variables = {}) {
  const token = getAccessToken();
  const res = await fetch(BUFFER_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Buffer API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const payload = await res.json();
  if (payload.errors && payload.errors.length > 0) {
    const msg = payload.errors.map((e) => e.message).join("; ");
    throw new Error(`Buffer GraphQL error: ${msg.slice(0, 300)}`);
  }
  return payload.data;
}

// Buffer's new API scopes everything to an organization. Fetch the first
// organization the authenticated account has access to and cache it.
async function getOrganizationId() {
  const cacheKey = "buffer:org-id";
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const data = await bufferGraphQL(`
    query {
      account {
        organizations {
          id
          name
        }
      }
    }
  `);
  const orgs = data?.account?.organizations || [];
  if (orgs.length === 0) throw new Error("No Buffer organizations found for this account.");
  const orgId = orgs[0].id;
  cacheSet(cacheKey, orgId, TTL.org);
  return orgId;
}

// Returns the first LinkedIn channel for the organization, in the shape the
// existing /api/linkedin route expects: { id, name, followers }. Follower
// count may not be exposed by the GraphQL API — returns null when absent.
async function getLinkedInProfile() {
  const cacheKey = "buffer:linkedin-channel";
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const orgId = await getOrganizationId();
  const data = await bufferGraphQL(
    `
    query ChannelsForOrg($orgId: OrganizationId!) {
      channels(input: { organizationId: $orgId }) {
        id
        name
        service
        avatar
      }
    }
    `,
    { orgId }
  );

  const channels = data?.channels || [];
  const linkedin = channels.find((c) => {
    const s = (c.service || "").toLowerCase();
    return s === "linkedin" || s.startsWith("linkedin");
  });
  if (!linkedin) return null;

  const result = {
    id: linkedin.id,
    name: linkedin.name || "LinkedIn",
    // Follower count isn't exposed on the Channel type in the new API as of
    // this writing. Leaving null; the view already handles that gracefully.
    followers: null,
  };
  cacheSet(cacheKey, result, TTL.channel);
  return result;
}

// Returns sent posts for the given channel in the shape the existing route
// expects. New API gives us reactions, comments, impressions, and
// engagementRate directly; shares/clicks are pulled from the metrics[]
// array by type where available.
async function getLinkedInPosts(channelId, count = 25) {
  const cacheKey = `buffer:linkedin-posts:${channelId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const orgId = await getOrganizationId();
  const data = await bufferGraphQL(
    `
    query SentPosts($orgId: OrganizationId!, $channelId: ChannelId!, $first: Int!) {
      posts(
        first: $first
        input: {
          organizationId: $orgId
          filter: { status: [sent], channelIds: [$channelId] }
        }
      ) {
        edges {
          node {
            id
            text
            sentAt
            reactions
            comments
            impressions
            engagementRate
            metrics {
              type
              value
              name
            }
          }
        }
      }
    }
    `,
    { orgId, channelId, first: count }
  );

  const edges = data?.posts?.edges || [];
  const posts = edges.map(({ node: u }) => {
    const metricsByType = Object.fromEntries(
      (u.metrics || []).map((m) => [String(m.type || m.name || "").toLowerCase(), Number(m.value || 0)])
    );
    return {
      id: u.id,
      text: u.text || "",
      sentAt: u.sentAt || null,
      stats: {
        impressions: Number(u.impressions || 0),
        clicks:      metricsByType.clicks || metricsByType.linkclicks || 0,
        reactions:   Number(u.reactions || 0),
        comments:    Number(u.comments || 0),
        shares:      metricsByType.shares || metricsByType.reshares || 0,
      },
    };
  });

  cacheSet(cacheKey, posts, TTL.posts);
  return posts;
}

export { getLinkedInProfile, getLinkedInPosts };
