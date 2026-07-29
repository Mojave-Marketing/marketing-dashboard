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

### Email Campaign Analytics
*Status: Live*

Connected directly to Mailchimp. Provides a full performance view for any campaign send:

- Open rate, click rate, click-to-open, bounces, and unsubscribes
- Engagement depth — how deeply recipients read and interacted with each email
- Top clicked links
- Funnel visualization from sent → delivered → opened → clicked
- Rolling trends and baseline across all historical sends so each campaign can be compared to our own average

---

### Events & Marketing Calendar
*Status: Live (Outlook-connected, coming soon)*

A shared marketing calendar view built around our existing Outlook calendar:

- Industry trade shows (AHR Expo, ACCA, etc.) with dates, locations, and attendance notes
- Marketing plans and notes tied to each event
- Email campaign schedule overlaid on the same view
- Managed directly from Outlook — no separate tool to maintain

This gives the team a single place to see what's coming up and what marketing activity surrounds each event.

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

### Form Submissions
*Status: Coming Soon*

Google Form responses (contact forms, quote requests, etc.) viewable directly in the dashboard — no need to open Google Sheets separately. Each form gets its own view with submitted data in a clean, readable format.

---

### AI-Assisted Campaign Summaries
*Status: Coming Soon*

Each email campaign report will include a short AI-generated narrative (3–4 sentences) that summarizes performance in plain language — open rate relative to our baseline, standout link activity, and a recommended focus area. Makes reports faster to scan and easier to share with leadership.

---

### Runbook
*Status: Coming Soon — Admin Only*

A living operations document covering campaign SOPs, form workflows, and event checklists. Accessible only to marketing admins. Maintained and updated by AI to reflect current team processes.

---

## Access & Security

- Password-protected — no accounts, SSO, or app installation required
- Accessible from any browser on any device
- Two access levels:
  - **User** — full dashboard access (email analytics, website, LinkedIn, forms, calendar)
  - **Admin** — adds access to the Runbook
- Hosted on Vercel; data is never stored in the dashboard itself — it's always pulled live from the source systems

---

## Phased Rollout

| Phase | Scope | Status |
|---|---|---|
| 1 | Email campaign analytics, secure login, brand | **Complete** |
| 2 | Sidebar navigation, Events & Calendar view | **In Progress** |
| 3 | Website analytics (GA4), Form submissions | Upcoming |
| 4 | LinkedIn analytics (file-based), AI campaign summaries | Upcoming |
| 5 | Runbook, dual-role access (User / Admin) | Upcoming |

---

## What's Live Today

The dashboard is live and password-protected at our Vercel deployment. Current capabilities:

- Full email campaign analytics for every Mailchimp send
- Trends & baseline view across all sends
- New sidebar navigation with section structure for all upcoming features
- Events & Marketing Calendar with placeholder industry events (AHR Expo, ACCA, etc.)
- "Coming Soon" placeholders for Website Analytics, LinkedIn, Forms, and Runbook

The goal of this meeting is to align on the roadmap, confirm the section priorities, and identify any additional data sources or use cases to include before Phase 3 begins.
