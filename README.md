# Marketing Reporting Dashboard

A Next.js dashboard that pulls rep-training campaign performance directly from
the Mailchimp Marketing API (no CSV exports) and renders KPI cards, a send
funnel, engagement-depth chart, top-clicked-links, and auto-generated
leadership takeaways.

## Status / what's built

- `lib/mailchimp.js` — server-side Mailchimp API client (campaigns list,
  report, click details, per-recipient email activity). Never exposed to the
  browser.
- `app/api/campaigns/route.js` — lists campaigns matching your filter
- `app/api/campaigns/[id]/route.js` — full breakdown for one campaign,
  including computed KPIs, funnel, engagement buckets, top links, and
  takeaways
- `app/page.js` + `components/*` — the dashboard UI (KPI cards, funnel chart,
  engagement-depth chart, top-links table, takeaways panel)
- Verified: `npm install` and `npm run build` both succeed. Dev server boots
  and the API route correctly reports a config error when no credentials are
  set (expected, since none are configured yet).

**Not yet done / needs your input in Claude Code:**
- A real `MAILCHIMP_API_KEY` + `MAILCHIMP_SERVER_PREFIX` (see below) — nothing
  has been tested against live Mailchimp data yet.
- Confirm the filter approach actually finds your campaigns (see "Identifying
  rep training campaigns" below) — this was built against Mailchimp's public
  API docs/spec but not against your actual account data.
- A trends/baseline view across multiple sends (the original CSV-based
  version had this; this rebuild only covers "one campaign at a time" so far).
- Push to GitHub + connect to Vercel.

## Important: Mailchimp API key doesn't exist yet

You said you don't have one yet. To create one:

1. Log into Mailchimp → click your profile icon (bottom left) → **Profile**
2. Go to **Extras → API keys**
3. Click **Create A Key**
4. Copy the key immediately — Mailchimp only shows it once. It looks like
   `abc123def456...-us21`
5. The **server prefix** is the part after the final dash (`us21` in that
   example). You can also see it in your Mailchimp account URL:
   `https://us21.admin.mailchimp.com`

Put both into a `.env.local` file locally (copy `.env.local.example` and fill
it in) and into Vercel's environment variables when you deploy. **Never commit
`.env.local` to git** — it's already in `.gitignore`.

## Identifying "rep training" campaigns

Mailchimp's public API has no campaign-level tag filter (only list/member
tags are filterable, confirmed against the official API spec). Two options,
controlled by `MAILCHIMP_FILTER_MODE` in your env vars:

- **`title`** (default) — matches campaigns whose title contains
  `MAILCHIMP_TITLE_MATCH` (e.g. "Rep Training"). Works immediately, no
  Mailchimp reorganization needed, as long as you've been naming these sends
  consistently.
- **`folder`** — filters by `MAILCHIMP_FOLDER_ID`. More reliable long-term,
  but requires moving these campaigns into a dedicated Mailchimp folder
  first (Campaigns → select campaigns → Move to folder).

If neither fits how your account is organized, this is the first thing worth
adjusting in Claude Code once you can see your real campaign list.

## Local development

```bash
npm install
cp .env.local.example .env.local
# edit .env.local with your real API key, server prefix, and filter settings
npm run dev
```

Open http://localhost:3000

## Deploying to Vercel

1. Push this project to a GitHub repo
2. Go to vercel.com → **Add New Project** → import the repo
3. Vercel auto-detects Next.js — no build config needed
4. Under **Environment Variables**, add everything from `.env.local.example`
   with your real values
5. Deploy

## Project structure

```
app/
  page.js              # main dashboard UI (client component)
  layout.js
  globals.css
  api/
    campaigns/route.js         # GET list of matching campaigns
    campaigns/[id]/route.js    # GET full breakdown for one campaign
components/
  KpiCard.jsx
  FunnelChartCard.jsx
  EngagementDepthChartCard.jsx
  TopLinksCard.jsx
  Takeaways.jsx
lib/
  mailchimp.js          # server-side Mailchimp API client
```

## A note on dependencies

`next` is pinned to `^14.2.35` (patches known Dec 2025 RSC vulnerabilities).
`npm audit` will still show some advisories that mostly affect features this
app doesn't use (next/image, custom middleware, WebSocket upgrades) — worth a
look before going to production, but not blocking for internal dashboard use.
