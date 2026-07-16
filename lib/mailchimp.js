// Server-side only. Never import this from a Client Component or expose
// MAILCHIMP_API_KEY to the browser bundle.

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
      // Mailchimp accepts any string as the basic-auth username; the API key
      // is the password. "anystring" is the conventional placeholder.
      Authorization: "Basic " + Buffer.from(`anystring:${apiKey}`).toString("base64"),
    },
    // Reports don't change on old sends, but recent/current-send data does.
    // Individual routes override this where needed.
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

/**
 * Fetch all campaigns matching our "rep training" filter, paginating as needed.
 * mode: "title" (default) matches settings.title case-insensitively against titleMatch.
 *       "folder" filters server-side via folder_id.
 */
async function listRepTrainingCampaigns({
  mode = process.env.MAILCHIMP_FILTER_MODE || "title",
  titleMatch = process.env.MAILCHIMP_TITLE_MATCH || "",
  titleExclude = process.env.MAILCHIMP_TITLE_EXCLUDE || "",
  folderId = process.env.MAILCHIMP_FOLDER_ID || "",
} = {}) {
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

  // Paginate until we've fetched everything (or hit a sane safety cap).
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

  return all.map((c) => ({
    id: c.id,
    title: c.settings?.title || "(untitled)",
    subjectLine: c.settings?.subject_line || "",
    sendTime: c.send_time,
    emailsSent: c.emails_sent,
    status: c.status,
  }));
}

/** Full report summary for one campaign (opens, clicks, bounces, unsubs, etc). */
async function getCampaignReport(campaignId) {
  return mcFetch(`/reports/${campaignId}`);
}

/** Top clicked links for a campaign. */
async function getCampaignClickDetails(campaignId) {
  const data = await mcFetch(`/reports/${campaignId}/click-details`, {
    searchParams: { count: "50" },
  });
  return data.urls_clicked || [];
}

/**
 * Per-recipient email activity (opens/clicks per person) for engagement-depth
 * bucketing. Paginates since large sends can exceed one page.
 */
async function getCampaignEmailActivity(campaignId) {
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

  return all;
}

export {
  listRepTrainingCampaigns,
  getCampaignReport,
  getCampaignClickDetails,
  getCampaignEmailActivity,
};
