# Mojave Marketing Command Center
## Product Overview & Roadmap

**Prepared for:** Head of Marketing  
**Prepared by:** Marketing Operations  
**Date:** July 2026

---

## What It Is

The Mojave Marketing Command Center is a private, password-protected web dashboard that brings all of Mojave's marketing performance data and activity planning into one place — accessible from any browser, no installation required.

Instead of switching between Mailchimp, Google Analytics, LinkedIn, and separate spreadsheets to get a picture of how marketing is performing, everything lives in a single organized view.

---

## Sections Overview

### Events & Marketing Calendar
*Status: Live*

The home page of the dashboard. A shared marketing calendar view built around our existing Outlook calendar:

- Industry trade shows (AHR Expo, ACCA, etc.) with dates, locations, and attendance notes
- Marketing plans and notes tied to each event
- Email campaign schedule overlaid on the same view
- Managed directly from Outlook — no separate tool to maintain

---

### Email Campaign Analytics
*Status: Live*

Connected directly to Mailchimp. Provides a full performance view for any campaign send:

- Open rate, click rate, click-to-open, bounces, and unsubscribes
- Engagement depth — how deeply recipients read and interacted with each email
- Top clicked links with click counts
- Funnel visualization from sent → delivered → opened → clicked
- Contact list showing who opened and clicked each campaign
- Rolling trends and baseline across all historical sends so each campaign can be compared to our own average
- Results are cached so the dashboard loads quickly without hitting Mailchimp on every visit

---

### Survey Responses
*Status: Live*

Form responses from Zapier-connected surveys viewable directly in the dashboard — no need to open a spreadsheet separately. Each survey gets its own view with submitted data in a clean, readable format.

Current surveys:
- Arctidry Training
- Rep Company Feedback
- Arctidry Feedback

New responses flow in automatically via Zapier webhooks and are stored securely on Vercel Blob storage. Additional surveys can be added by creating a new Zap — no code changes required.

---

### Runbook
*Status: Live*

A living operations document covering campaign SOPs, form workflows, and event checklists. Accessible to anyone with dashboard access. Maintained and updated by AI to reflect current team processes.

---

### Website Analytics
*Status: Coming Soon*

Key traffic metrics pulled directly from Google Analytics into the dashboard — no need to log into GA separately:

- Sessions, users, and pageviews
- Bounce rate
- Top pages
- Traffic source breakdown (organic search, direct, email, social)

---

### LinkedIn Analytics
*Status: Coming Soon*

Mojave's LinkedIn company page performance, reviewed from inside the dashboard:

- Follower growth over time
- Post impressions and engagement rate
- Top performing posts
- Data sourced from exported LinkedIn reports — no complex API integration required

---

### AI-Assisted Campaign Summaries
*Status: Coming Soon*

Each email campaign report will include a short AI-generated narrative (3–4 sentences) that summarizes performance in plain language — open rate relative to our baseline, standout link activity, and a recommended focus area. Makes reports faster to scan and easier to share with leadership.

---

## Access & Security

- Password-protected — no accounts, SSO, or app installation required
- Accessible from any browser on any device
- Single access level — everyone with the password sees the full dashboard including the Runbook
- Hosted on Vercel; all data is pulled live from source systems or stored in Vercel Blob; no separate database is needed at current scale

---

## Phased Rollout

| Phase | Scope | Status |
|---|---|---|
| 1 | Email campaign analytics, secure login, brand | **Complete** |
| 2 | Sidebar navigation, Events & Calendar, Survey Responses, Runbook | **Complete** |
| 3 | Website analytics (GA4), LinkedIn analytics (file-based) | Upcoming |
| 4 | AI campaign summaries | Upcoming |
| 5 | Outlook calendar live sync via Zapier webhook | Upcoming |

---

## What's Live Today

The dashboard is live and password-protected at our Vercel deployment. Current capabilities:

- Full email campaign analytics for every Mailchimp send, with caching for fast loads
- Trends & baseline view across all historical sends
- Contact-level opens and clicks per campaign
- Events & Marketing Calendar with upcoming trade shows and campaign dates
- Survey Responses for 3 active surveys, auto-populated via Zapier
- Runbook with current marketing SOPs
- Collapsible sidebar navigation with "Coming Soon" placeholders for Website and LinkedIn Analytics

---

## Infrastructure Notes

**No database needed at current scale.** Survey responses and future webhook data are stored in Vercel Blob — a simple, cost-effective file store well-suited for low-volume internal tools. A dedicated database (Postgres, etc.) would only be warranted if the app grows to thousands of records with complex querying needs, or if multiple data types need relational linking (e.g. contacts linked to campaigns linked to survey responses). That decision can be revisited if the tool expands beyond marketing ops use.
