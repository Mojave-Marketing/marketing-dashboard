# Mojave Marketing Command Center — CLAUDE.md

## Project Overview

Internal marketing operations dashboard for Mojave HVAC. Centralizes email campaign
analytics, Google Form responses, website analytics, LinkedIn analytics, events calendar,
and process documentation in one password-protected tool.

**App name:** Marketing Command Center  
**Owner:** j.ossa@mojavehvac.com  
**Stack:** Next.js 14 (App Router), deployed on Vercel  
**Users:** Internal only — one admin user (j.ossa), potential read-only users later  
**Microsoft 365:** Used for calendar (Outlook) only. Google is used only for Forms and GA4.

---

## Architecture

### Routing

App Router with file-based routes:

| Route | Purpose |
|---|---|
| `/` | Marketing Emails — Campaign view |
| `/analytics/website` | GA4 website analytics |
| `/analytics/linkedin` | LinkedIn company page analytics |
| `/forms/[formId]` | Google Form submission viewer |
| `/runbook` | Admin-only process documentation |
| `/login` | Unauthenticated entry point |
| `/api/*` | Server-side data routes (never expose raw API keys) |

### Nav Structure

Left sidebar (collapsible), rendered by `components/Sidebar.jsx` inside `components/AppShell.jsx`.
The sidebar is role-aware — Runbook is hidden entirely for `user` role.

```
Marketing Emails
  ├── Campaign              (/)
  └── Trends & Baseline     (/?view=trends)

Website Analytics
  └── Overview              (/analytics/website)

LinkedIn Analytics
  └── Overview              (/analytics/linkedin)

Form Submissions
  └── [Form Name]           (/forms/[formId])   — one per GOOGLE_FORM_SHEETS entry

Runbook                     (/runbook)           — admin role only
```

### Auth Model

Single password, single role — everyone who logs in has the same access.
- `DASHBOARD_PASSWORD` → grants access to the full dashboard

A signed JWT is stored as `__session` cookie. `middleware.js` validates the cookie on
every request. There is no role distinction and no admin-only routing.

### Key Files

| File | Purpose |
|---|---|
| `middleware.js` | Auth gate — validates session on every request |
| `lib/session.js` | JWT sign/verify helpers |
| `app/api/login/route.js` | Checks which password was used, sets role in cookie |
| `components/Sidebar.jsx` | Collapsible left nav, role-aware |
| `components/AppShell.jsx` | Layout wrapper: sidebar + main content area |
| `app/page.js` | Marketing Emails views (Campaign + Trends) |
| `app/analytics/website/page.js` | GA4 website stats |
| `app/analytics/linkedin/page.js` | LinkedIn company page stats |
| `app/forms/[formId]/page.js` | Google Form submission view |
| `app/runbook/page.js` | Runbook iframe (admin only) |

---

## Environment Variables

**Rule: never add a new env var to code without adding it to this table first.**

| Variable | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | Yes | Signs the session JWT |
| `DASHBOARD_PASSWORD` | Yes | User-role login password |
| `MAILCHIMP_API_KEY` | Yes | Mailchimp Reports API |
| `MAILCHIMP_SERVER_PREFIX` | Yes | e.g. `us6` |
| `MAILCHIMP_FILTER_MODE` | No | `folder` or `title` |
| `MAILCHIMP_TITLE_MATCH` | No | Title substring filter |
| `MAILCHIMP_FOLDER_ID` | No | Folder ID filter |
| `ANTHROPIC_API_KEY` | Yes (AI summaries) | Claude API for campaign narrative summaries |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Yes (Forms + GA4) | Base64-encoded service account JSON |
| `GOOGLE_FORM_SHEETS` | Yes (Forms) | JSON array: `[{name, sheetId, tabName}]` |
| `GA4_PROPERTY_ID` | Yes (Website Analytics) | Google Analytics 4 property ID |
| `AZURE_TENANT_ID` | Yes (Calendar) | Microsoft 365 tenant ID |
| `AZURE_CLIENT_ID` | Yes (Calendar) | Azure AD app registration client ID |
| `AZURE_CLIENT_SECRET` | Yes (Calendar) | Azure AD app registration client secret |
| `OUTLOOK_CALENDAR_ID` | Yes (Calendar) | ID of the shared Outlook marketing calendar |
| `BLOB_READ_WRITE_TOKEN` | Yes (Surveys) | Vercel Blob token for survey response storage |
| `WEBHOOK_SECRET` | Yes (Surveys) | Shared secret to authenticate Zapier webhook POSTs |
| `WEBHOOK_FORMS` | No | JSON array override: `[{id, name}]` for survey nav items |
| `BUFFER_CLIENT_ID` | Yes (LinkedIn) | Buffer OAuth app client ID |
| `BUFFER_SECRET_ID` | Yes (LinkedIn) | Buffer OAuth app client secret |
| `BUFFER_API` | Yes (LinkedIn) | Buffer OAuth access token — obtained via /api/auth/buffer one-time flow |

If a section's required env vars are missing, that nav section must be **hidden from the
sidebar** and its route must return a 404 or redirect — not crash.

---

## Development Principles

1. **Structural changes first.** Sidebar layout and dual-role auth ship before any new
   data section. Don't build data features on top of the old layout.

2. **Auth is sacred.** Any change to `middleware.js` or `lib/session.js` requires
   re-testing the full login flow (both roles, both password paths) before that change
   can be considered done.

3. **No role leakage.** Admin-only content is blocked at the middleware route level.
   Hiding it in the sidebar UI is not sufficient on its own.

4. **Graceful degradation over crashes.** If an optional integration's env vars are
   absent, hide the section. Never let a missing env var break the whole dashboard.

5. **Env var discipline.** Document the env var in this file before writing code that
   uses it. This keeps the table authoritative.

6. **No premature abstraction.** Three similar components is fine. Extract a shared
   abstraction only when there are four or more and the pattern is clearly stable.

7. **One section at a time.** Complete a section (including its tests) before starting
   the next. Partial implementations should not be merged.

---

## Testing Requirements

Every new feature, component, or route must pass **both** levels before it is complete.

### Level 1 — Unit / Component Tests (Jest + React Testing Library)

- **Location:** `__tests__/` directory, mirroring component/API paths
- **Required for:** every new component, every new API route
- **Must cover:** happy path, empty/null/missing data, error state

```bash
npm test              # run all Jest tests
npm test -- --watch   # watch mode during development
```

### Level 2 — End-to-End Tests (Playwright)

- **Location:** `e2e/` directory
- **Required for:** any new page route, any auth-gated feature, any middleware change
- **Must cover:**
  - Unauthenticated user → redirected to `/login`
  - `user` role → correct pages load; admin pages (Runbook) redirect away
  - `admin` role → all pages load correctly
  - Golden path of the feature (real-ish data or mocked API)

```bash
npm run test:e2e           # Playwright headless
npm run test:e2e -- --ui   # Playwright UI mode for debugging
```

### Test setup note

As of project start, no test framework is installed. Before writing the first test,
install and configure:

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom
npm install --save-dev @playwright/test && npx playwright install
```

Then add to `package.json`:
```json
"scripts": {
  "test": "jest",
  "test:e2e": "playwright test"
}
```

### Completion checklist

Before marking any task done:

- [ ] `npm test` passes with no new failures
- [ ] `npm run test:e2e` passes for all affected flows
- [ ] New env vars are documented in the table above
- [ ] Auth behavior verified manually for both roles (if route or middleware changed)
- [ ] Nav section hidden correctly when its env vars are absent

---

## Before You Build — Required Questions

Answer all of these before writing any code for a new feature:

1. Does this feature require a new env var? → Add it to the table above first.
2. Does this touch `middleware.js` or `lib/session.js`? → Plan a full auth re-test.
3. Does this add a new route? → Add it to the Routing table and Nav Structure above.
4. Is the new section optional (env-var-gated)? → Confirm the sidebar hides it when vars are absent.
5. Is any part of this admin-only? → Confirm it's blocked at middleware level, not just UI.
6. What does the empty/error state look like? → Design it before coding the happy path.

---

## Integration Notes

### Website Analytics (GA4)
- Uses the **Google Analytics Data API v1**
- Auth: same `GOOGLE_SERVICE_ACCOUNT_KEY` service account used for Forms
- The service account must be added as a **Viewer** on the GA4 property
- Metrics to pull: sessions, users, pageviews, bounce rate, top pages, traffic sources
- Library: `@googleapis/analyticsdata`

### LinkedIn Analytics (File-Based — No API)
- **No LinkedIn API.** The company cannot obtain API access. Do NOT attempt API integration.
- Data source: exported CSV/Excel files downloaded from LinkedIn Analytics by the user
- Two intake options (decide at build time):
  1. **Folder drop:** user places exported files in `data/linkedin/`; backend reads on request
  2. **UI upload:** user uploads file via dashboard UI; frontend parses and renders charts
- LinkedIn exports include: follower stats, post impressions, engagement, visitor demographics
- Use a CSV parsing library (e.g. `papaparse`) to process the exports client-side

### Google Form Submissions
- Reads from Google Sheets linked to each Form (service account auth)
- **Google is only used for Forms and Google Analytics — all other services use Microsoft 365**
- Config: `GOOGLE_FORM_SHEETS` JSON array — `[{"name": "Contact Form", "sheetId": "abc123", "tabName": "Sheet1"}]`
- One sidebar sub-item per entry in the array

### Events & Calendar (Microsoft Outlook)
- Uses the **Microsoft Graph API** to read from an Outlook calendar
- Company uses Microsoft 365 — do NOT suggest Google Calendar for this integration
- Auth: Azure AD app registration with client credentials flow (no user login required)
  - Register an app in Azure Portal → API permissions: `Calendars.Read` (application permission)
  - Grant admin consent for the tenant
- Recommended setup: create a shared calendar called "Mojave Marketing" in Outlook, add events there
- The dashboard reads all events from that calendar and displays them with notes (event body = plan notes)
- Env vars: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `OUTLOOK_CALENDAR_ID`
- Library: `@microsoft/microsoft-graph-client` or plain fetch against `https://graph.microsoft.com/v1.0`

### AI Narrative Summaries (Mailchimp Campaigns)
- Model: `claude-sonnet-4-6`
- Generates a 3–4 sentence executive summary per campaign
- Displayed as an "AI Summary" card above the KPI grid
- Keep prompt and token usage lean — this runs on every campaign page load
