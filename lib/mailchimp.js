// Server-side only. Never import this from a Client Component or expose
// MAILCHIMP_API_KEY to the browser bundle.

import { cacheGet, cacheSet } from "./cache";

const TTL = {
  campaigns:   10 * 60 * 1000,  // 10 min — list of campaigns
  report:      15 * 60 * 1000,  // 15 min — individual report summary
  clicks:      30 * 60 * 1000,  // 30 min — historical click data
  activity:    30 * 60 * 1000,  // 30 min — per-recipient activity
  mergeFields: 60 * 60 * 1000,  // 1 hour — merge field tag discovery
  members:     30 * 60 * 1000,  // 30 min — audience member profiles
};

function getConfig() {
  const apiKey = process.env.MAILCHIMP_API_KEY;
  const serverPrefix = process.env.MAILCHIMP_SERVER_PREFIX;

  if (!apiKey || !serverPrefix) {
    throw new Error(
      "Missing MAILCHIMP_API_KEY or MAILCHIMP_SERVER_PREFIX environment variables."
    );
  }

  return {
    apiKey,
    serverPrefix,
    baseUrl: `https://${serverPrefix}.api.mailchimp.com/3.0`,
  };
}

async function mcFetch(path, { searchParams } = {}) {
  const { apiKey, baseUrl } = getConfig();

  const url = new URL(`${baseUrl}${path}`);
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: "Basic " + Buffer.from(`anystring:${apiKey}`).toString("base64"),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(
      `Mailchimp API error ${res.status} for ${path}: ${body.slice(0, 500)}`
    );
    err.status = res.status;
    throw err;
  }

  return res.json();
}

async function listRepTrainingCampaigns({
  mode = process.env.MAILCHIMP_FILTER_MODE || "title",
  titleMatch = process.env.MAILCHIMP_TITLE_MATCH || "",
  titleExclude = process.env.MAILCHIMP_TITLE_EXCLUDE || "",
  folderId = process.env.MAILCHIMP_FOLDER_ID || "",
} = {}) {
  const cacheKey = `campaigns:${mode}:${titleMatch}:${titleExclude}:${folderId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const count = 100;
  let offset = 0;
  let all = [];

  const baseParams = {
    status: "sent",
    sort_field: "send_time",
    sort_dir: "DESC",
    count: String(count),
  };
  if (mode === "folder" && folderId) {
    baseParams.folder_id = folderId;
  }

  for (let page = 0; page < 20; page++) {
    const data = await mcFetch("/campaigns", {
      searchParams: { ...baseParams, offset: String(offset) },
    });
    const campaigns = data.campaigns || [];
    all = all.concat(campaigns);
    if (campaigns.length < count) break;
    offset += count;
  }

  if (mode === "title") {
    if (titleMatch) {
      const needle = titleMatch.toLowerCase();
      all = all.filter((c) => (c.settings?.title || "").toLowerCase().includes(needle));
    }
    if (titleExclude) {
      const needle = titleExclude.toLowerCase();
      all = all.filter((c) => !(c.settings?.title || "").toLowerCase().includes(needle));
    }
  }

  const result = all.map((c) => ({
    id: c.id,
    title: c.settings?.title || "(untitled)",
    subjectLine: c.settings?.subject_line || "",
    sendTime: c.send_time,
    emailsSent: c.emails_sent,
    status: c.status,
  }));

  cacheSet(cacheKey, result, TTL.campaigns);
  return result;
}

async function getCampaignReport(campaignId) {
  const cacheKey = `report:${campaignId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const result = await mcFetch(`/reports/${campaignId}`);
  cacheSet(cacheKey, result, TTL.report);
  return result;
}

async function getCampaignClickDetails(campaignId) {
  const cacheKey = `clicks:${campaignId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const data = await mcFetch(`/reports/${campaignId}/click-details`, {
    searchParams: { count: "50" },
  });
  const result = data.urls_clicked || [];
  cacheSet(cacheKey, result, TTL.clicks);
  return result;
}

async function getCampaignEmailActivity(campaignId) {
  const cacheKey = `activity:${campaignId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const count = 1000;
  let offset = 0;
  let all = [];

  for (let page = 0; page < 20; page++) {
    const data = await mcFetch(`/reports/${campaignId}/email-activity`, {
      searchParams: { count: String(count), offset: String(offset) },
    });
    const emails = data.emails || [];
    all = all.concat(emails);
    if (emails.length < count) break;
    offset += count;
  }

  cacheSet(cacheKey, all, TTL.activity);
  return all;
}

// Discovers which merge field tags correspond to first name, last name, and company
// by checking for standard tag names (FNAME/LNAME/COMPANY) first, then keyword-matching
// the human-readable field names for audiences that use custom tags.
async function discoverMergeFieldTags(listId) {
  const cacheKey = `merge-fields:${listId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const data = await mcFetch(`/lists/${listId}/merge-fields`, {
    searchParams: { count: "50" },
  });
  const fields = data.merge_fields || [];

  function findTag(preferredTags, nameKeywords) {
    const byTag = fields.find((f) => preferredTags.includes((f.tag || "").toUpperCase()));
    if (byTag) return byTag.tag;
    const byName = fields.find((f) =>
      nameKeywords.some((kw) => (f.name || "").toLowerCase().includes(kw))
    );
    return byName?.tag || null;
  }

  const result = {
    firstName: findTag(["FNAME"], ["first name", "first"]),
    lastName:  findTag(["LNAME"], ["last name", "last"]),
    company:   findTag(["COMPANY"], ["company", "organization", "org"]),
  };

  cacheSet(cacheKey, result, TTL.mergeFields);
  return result;
}

// Returns a Map<lowercase_email → {firstName, lastName, company}> for the full audience.
// Cached per list ID so subsequent campaign detail loads within 30 min are instant.
async function getListMemberProfiles(listId) {
  const cacheKey = `members:${listId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const tags = await discoverMergeFieldTags(listId);

  const count = 1000;
  let offset = 0;
  const profileMap = new Map();

  for (let page = 0; page < 20; page++) {
    const data = await mcFetch(`/lists/${listId}/members`, {
      searchParams: {
        fields: "members.email_address,members.merge_fields",
        count: String(count),
        offset: String(offset),
      },
    });
    const members = data.members || [];
    for (const member of members) {
      const mf = member.merge_fields || {};
      profileMap.set(member.email_address.toLowerCase(), {
        firstName: tags.firstName ? (mf[tags.firstName] || null) : null,
        lastName:  tags.lastName  ? (mf[tags.lastName]  || null) : null,
        company:   tags.company   ? (mf[tags.company]   || null) : null,
      });
    }
    if (members.length < count) break;
    offset += count;
  }

  cacheSet(cacheKey, profileMap, TTL.members);
  return profileMap;
}

// Mailchimp polls (*|POLL:id:choice|*) render as 10 tracked URLs in the sent
// email, one per rating choice. Each URL contains `POLL=<poll_id>:<option_id>`.
// This helper fetches click-details for a campaign, detects any poll URLs,
// and returns results in one of two shapes:
//   - "per-recipient": each voter's email + chosen rating (if Mailchimp's
//     members endpoint attributes clicks for poll URLs)
//   - "aggregate":     total votes per rating choice (if attribution is
//     anonymous, which is Mailchimp's default behavior for polls)
// Returns null when no poll URLs are found in the campaign's click-details.
async function getCampaignPollResults(campaignId) {
  const links = await getCampaignClickDetails(campaignId);
  if (!links || links.length === 0) return null;

  // A poll URL is any clicked URL containing `POLL=<poll_id>:<option_id>`.
  const pollRe = /[?&]POLL=(\d+):(\d+)/;
  const pollLinks = [];
  for (const link of links) {
    const m = typeof link.url === "string" ? link.url.match(pollRe) : null;
    if (!m) continue;
    pollLinks.push({
      url: link.url,
      linkId: link.id,
      totalClicks: link.total_clicks || 0,
      uniqueClicks: link.unique_clicks || 0,
      pollId: m[1],
      optionId: Number(m[2]),
    });
  }
  if (pollLinks.length === 0) return null;

  // Group by poll_id. For a 1-10 rating, we expect exactly one poll group of
  // ~10 options. If multiple polls exist in a single campaign, we pick the
  // one with the most options.
  const byPoll = new Map();
  for (const l of pollLinks) {
    if (!byPoll.has(l.pollId)) byPoll.set(l.pollId, []);
    byPoll.get(l.pollId).push(l);
  }
  const [pollId, options] = [...byPoll.entries()].sort(
    (a, b) => b[1].length - a[1].length
  )[0];

  // Assign a rating to each option by sorting by option_id ascending (the
  // original poll choice order Mailchimp preserves).
  options.sort((a, b) => a.optionId - b.optionId);
  const choices = options.map((o, idx) => ({ ...o, rating: idx + 1 }));

  // Try per-recipient attribution via /click-details/{link_id}/members. If
  // Mailchimp returns member rows, build the per-recipient shape; otherwise
  // fall back to aggregate counts.
  const perChoiceMembers = await Promise.all(
    choices.map(async (c) => {
      try {
        const data = await mcFetch(`/reports/${campaignId}/click-details/${c.linkId}/members`, {
          searchParams: { count: "1000" },
        });
        return { rating: c.rating, members: data.members || [] };
      } catch {
        return { rating: c.rating, members: [] };
      }
    })
  );
  const anyAttributed = perChoiceMembers.some((pc) => pc.members.length > 0);

  if (anyAttributed) {
    const responses = [];
    for (const { rating, members } of perChoiceMembers) {
      for (const member of members) {
        responses.push({
          Email: member.email_address,
          Rating: rating,
          _receivedAt: member.last_click || member.timestamp || new Date().toISOString(),
        });
      }
    }
    responses.sort((a, b) => new Date(b._receivedAt) - new Date(a._receivedAt));
    return { shape: "per-recipient", pollId, responses, total: responses.length };
  }

  const totalVotes = choices.reduce((s, c) => s + c.totalClicks, 0);
  const avgRating = totalVotes > 0
    ? choices.reduce((s, c) => s + c.rating * c.totalClicks, 0) / totalVotes
    : 0;
  return {
    shape: "aggregate",
    pollId,
    distribution: choices.map((c) => ({ rating: c.rating, votes: c.totalClicks })),
    totalVotes,
    avgRating,
  };
}

export {
  listRepTrainingCampaigns,
  getCampaignReport,
  getCampaignClickDetails,
  getCampaignEmailActivity,
  getListMemberProfiles,
  getCampaignPollResults,
};
