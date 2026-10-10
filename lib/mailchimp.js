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

// Mailchimp Surveys (standalone surveys with hosted URLs, distinct from the
// *|POLL:*|* inline merge tag which has no API).
//
// /reporting/surveys           → list of surveys for the account
// /reporting/surveys/{id}      → survey metadata
// /reporting/surveys/{id}/questions   → question schema + per-option counts
// /reporting/surveys/{id}/responses   → individual responses

async function listMailchimpSurveys() {
  const cacheKey = "mc:surveys:list";
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const data = await mcFetch("/reporting/surveys", { searchParams: { count: "100" } });
  const result = data.surveys || [];
  cacheSet(cacheKey, result, 10 * 60 * 1000);
  return result;
}

// Combines survey metadata + questions in one object. Each question includes
// its aggregate `options[]` with `count` per option — ideal for showing the
// response distribution without touching the responses endpoint.
async function getMailchimpSurveyWithQuestions(surveyId) {
  const cacheKey = `mc:survey:${surveyId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const [survey, qData] = await Promise.all([
    mcFetch(`/reporting/surveys/${surveyId}`),
    mcFetch(`/reporting/surveys/${surveyId}/questions`),
  ]);
  const result = { ...survey, questions: qData.questions || [] };
  cacheSet(cacheKey, result, 5 * 60 * 1000);
  return result;
}

// Fetches individual responses. Paginates (Mailchimp returns up to 1000 per
// request). Each response shape:
//   { id, contact: {email_address, full_name}, submitted_at, answers: [...] }
// Returns a Map<lowercase_email, string[]> of tag names for every member in
// the audience. One list_id costs one paginated fetch of all members; cached
// for 30 min alongside the merge-field profiles.
async function getListMemberTags(listId) {
  const cacheKey = `tags:${listId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const count = 1000;
  let offset = 0;
  const tagsByEmail = new Map();

  for (let page = 0; page < 20; page++) {
    const data = await mcFetch(`/lists/${listId}/members`, {
      searchParams: {
        fields: "members.email_address,members.tags",
        count: String(count),
        offset: String(offset),
      },
    });
    const members = data.members || [];
    for (const m of members) {
      const names = Array.isArray(m.tags) ? m.tags.map((t) => t.name).filter(Boolean) : [];
      tagsByEmail.set(m.email_address.toLowerCase(), names);
    }
    if (members.length < count) break;
    offset += count;
  }

  cacheSet(cacheKey, tagsByEmail, TTL.members);
  return tagsByEmail;
}

async function getMailchimpSurveyResponses(surveyId) {
  const cacheKey = `mc:survey-responses:${surveyId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const count = 1000;
  let offset = 0;
  let all = [];
  for (let page = 0; page < 20; page++) {
    const data = await mcFetch(`/reporting/surveys/${surveyId}/responses`, {
      searchParams: { count: String(count), offset: String(offset) },
    });
    const batch = data.responses || [];
    all = all.concat(batch);
    if (batch.length < count) break;
    offset += count;
  }

  cacheSet(cacheKey, all, 5 * 60 * 1000);
  return all;
}

export {
  listRepTrainingCampaigns,
  getCampaignReport,
  getCampaignClickDetails,
  getCampaignEmailActivity,
  getListMemberProfiles,
  getListMemberTags,
  listMailchimpSurveys,
  getMailchimpSurveyWithQuestions,
  getMailchimpSurveyResponses,
};
