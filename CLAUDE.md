# Mojave Marketing Command Center — CLAUDE.md

## Project Overview

Internal marketing operations dashboard for Mojave HVAC. Centralizes email campaign
analytics, Zapier-captured survey responses, website analytics, LinkedIn analytics,
events calendar, and process documentation in one password-protected tool.

**App name:** Marketing Command Center
**Owner:** j.ossa@mojavehvac.com
**Stack:** Next.js 14 (App Router), deployed on Vercel
**Users:** Internal only — single shared password, no roles
**Microsoft 365:** Will be used for calendar (Outlook) when that integration ships.
Google is only used for GA4 (planned). Survey intake is Zapier → Vercel Blob.

---

## Architecture

### Routing

App Router with file-based routes:

| Route | Purpose |
|---|---|
| `/` | Home — Events & Calendar |
| `/emails` | Marketing Emails — campaign detail view |
| `/emails/trends` | Marketing Emails — trends & baseline |
| `/analytics/website` | GA4 website analytics (Coming Soon placeholder) |
| `/analytics/linkedin` | LinkedIn company page analytics (via Buffer) |
| `/surveys/[formId]` | Survey response viewer (one per form in `WEBHOOK_FORMS`) |
| `/runbook` | Process documentation (iframe to `/public/runbook.html`) |
| `/login` | Unauthenticated entry point |
| `/api/*` | Server-side data routes (never expose raw API keys) |

### Nav Structure

Left sidebar (collapsible), rendered by `components/Sidebar.jsx` inside
`components/AppShell.jsx`. Everyone logged in sees everything — there are no roles.

```
Home
  └── Calendar              (/)

Marketing Emails
  ├── Trends & Baseline     (/emails/trends)
  └── Campaigns             (/emails)

Website Analytics            [Soon badge]
  └── Overview              (/analytics/website)

LinkedIn Analytics           [Soon badge in sidebar — the data path is live via Buffer]
  └── Overview              (/analytics/linkedin)

Survey Responses
  └── [Form Name]           (/surveys/[formId])   — one per WEBHOOK_FORMS entry

Runbook
  └── Runbook               (/runbook)
```

### Auth Model

Single password, single role — everyone who logs in has the same access.
- `DASHBOARD_PASSWORD` → grants access to the full dashboard

A signed HMAC token is stored as a `__session` cookie. `middleware.js` validates the
cookie on every request. There is no role distinction and no admin-only routing.

Public paths that bypass the gate (whitelisted in `middleware.js`):
- `/login`, `/api/login` — the auth flow itself
- `/api/webhooks/*` — Zapier submissions (auth is via `WEBHOOK_SECRET` query param)
- `/api/auth/buffer*` — Buffer OAuth callback
- `/logo.jpg` — brand mark used by the login page

### Key Files

| File | Purpose |
|---|---|
| `middleware.js` | Auth gate — validates session on every request |
| `lib/session.js` | HMAC token sign/verify helpers (works in Edge + Node) |
| `lib/cache.js` | In-memory TTL cache (survives across requests, resets on redeploy) |
| `lib/mailchimp.js` | Mailchimp Reports API client |
| `lib/buffer.js` | Buffer API client (LinkedIn posts + profile) |
| `app/api/login/route.js` | Validates password, sets session cookie |
| `app/api/webhooks/form/[formId]/route.js` | Zapier intake → one private blob per submission |
| `app/api/surveys/[formId]/route.js` | Lists per-form private blobs, returns responses |
| `app/api/campaigns/*` | Mailchimp campaign list, detail, trends |
| `app/api/linkedin/route.js` | Buffer-sourced LinkedIn post stats |
| `components/Sidebar.jsx` | Collapsible left nav |
| `components/AppShell.jsx` | Layout wrapper: sidebar + main content area |
| `app/page.js` | Home — hardcoded events calendar |
| `app/emails/page.js` | Marketing Emails campaign view |
| `app/emails/trends/page.js` | Marketing Emails trends view |
| `app/surveys/[formId]/page.js` | Survey response table |
| `app/runbook/page.js` | Runbook iframe |

---

## Environment Variables

**Rule: never add a new env var to code without adding it to this table first.**

| Variable | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | Yes | Signs the session HMAC token |
| `DASHBOARD_PASSWORD` | Yes | Shared password gate for the dashboard |
| `MAILCHIMP_API_KEY` | Yes | Mailchimp Reports API |
| `MAILCHIMP_SERVER_PREFIX` | Yes | e.g. `us21` |
| `MAILCHIMP_FILTER_MODE` | No | `folder` or `title` (default: `title`) |
| `MAILCHIMP_TITLE_MATCH` | No | Title substring filter when mode=title |
| `MAILCHIMP_TITLE_EXCLUDE` | No | Title substring to exclude (e.g. `Internal:`) |
| `MAILCHIMP_FOLDER_ID` | No | Folder ID filter when mode=folder |
| `BENCHMARK_OPEN_RATE` | No | Decimal benchmark for open rate (default: 0.26) |
| `BENCHMARK_CLICK_RATE` | No | Decimal benchmark for click rate (default: 0.03) |
| `BLOB_READ_WRITE_TOKEN` | Yes (Surveys) | Vercel Blob token for survey response storage |
| `WEBHOOK_SECRET` | Yes (Surveys) | Shared secret for Zapier webhook POSTs |
| `WEBHOOK_FORMS` | No | JSON array override: `[{id, name}]` for survey nav items |
| `BUFFER_CLIENT_ID` | Yes (LinkedIn) | Buffer OAuth app client ID |
| `BUFFER_SECRET_ID` | Yes (LinkedIn) | Buffer OAuth app client secret |
| `BUFFER_API` | Yes (LinkedIn) | Buffer access token — obtained via `/api/auth/buffer` one-time flow |
| `ANTHROPIC_API_KEY` | Planned (AI summaries) | Claude API for campaign narrative summaries |
| `GA4_PROPERTY_ID` | Planned (Website Analytics) | Google Analytics 4 property ID |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Planned (GA4) | Base64-encoded service account JSON |
| `AZURE_TENANT_ID` | Planned (Calendar) | Microsoft 365 tenant ID |
| `AZURE_CLIENT_ID` | Planned (Calendar) | Azure AD app registration client ID |
| `AZURE_CLIENT_SECRET` | Planned (Calendar) | Azure AD app registration client secret |
| `OUTLOOK_CALENDAR_ID` | Planned (Calendar) | ID of the shared Outlook marketing calendar |

If a section's required env vars are missing, that nav section must be **hidden from
the sidebar** and its route must return a 404 or redirect — not crash.

---

## Development Principles

1. **Structural changes first.** Sidebar layout and auth ship before any new data
   section. Don't build data features on top of the old layout.

2. **Auth is sacred.** Any change to `middleware.js` or `lib/session.js` requires
   re-running the full auth test suite (`__tests__/middleware.test.js`,
   `__tests__/api/login.test.js`, `e2e/login.spec.js`) before that change can be
   considered done.

3. **Graceful degradation over crashes.** If an optional integration's env vars are
   absent, hide the section. Never let a missing env var break the whole dashboard.

4. **Env var discipline.** Document the env var in this file before writing code that
   uses it. This keeps the table authoritative.

5. **No premature abstraction.** Three similar components is fine. Extract a shared
   abstraction only when there are four or more and the pattern is clearly stable.

6. **One section at a time.** Complete a section (including its tests) before starting
   the next. Partial implementations should not be merged.

7. **TDD on new code, backfill tests on changes to legacy code.** Red → green → commit.
   When you touch a function without a test, write the test first.

---

## Testing

The test harness is installed and gated by CI. Three layers:

### Jest unit + component (jsdom + node projects)

- **Location:** `__tests__/` directory, mirroring source paths
- **Required for:** every new component, every new API route, every lib function
- **Must cover:** happy path, empty/null/missing data, error state

```bash
npm test              # run all Jest tests (both projects)
npm run test:watch    # watch mode during development
npm run test:coverage # with coverage report + threshold enforcement
```

### Playwright E2E

- **Location:** `e2e/` directory
- **Required for:** any new page route, any auth-gated feature, any middleware change
- **Must cover:**
  - Unauthenticated user → redirected to `/login`
  - Logged-in user → the new page loads with mocked API data
  - Golden path interaction (click, submit, etc.)

```bash
npm run test:e2e      # Playwright headless, auto-starts dev server
```

E2E runs against a dev server launched with deterministic test env vars (set in
`playwright.config.js webServer.env`). Mock external APIs via `page.route()` using
the helpers in `e2e/helpers.js` (`login`, `mockApi`).

### Coverage threshold (CI gate)

Enforced per-directory at 80% lines/branches/functions/statements:
- `lib/`
- `app/api/`
- `middleware.js`
- `components/`

`app/*/page.js` is excluded from Jest coverage — pages are server-component wrappers
tested via Playwright, not Jest. If you add a new top-level directory with
non-trivial code, add it to the `coverageThreshold` block in `jest.config.js`.

### Pre-commit + CI

- `.husky/pre-commit` runs `lint-staged`, which runs
  `jest --bail --findRelatedTests --passWithNoTests` on staged `.js`/`.jsx` files.
- `.github/workflows/test.yml` runs the full Jest suite with coverage and the
  Playwright suite on every PR and push to `main`.
- Don't bypass hooks with `--no-verify`. If a hook fails, fix the underlying issue.

### Completion checklist

Before marking any task done:

- [ ] `npm test` passes with no new failures
- [ ] `npm run test:e2e` passes for all affected flows
- [ ] New env vars are documented in the table above
- [ ] Auth behavior verified when `middleware.js` or `lib/session.js` changed
- [ ] Nav section hidden correctly when its env vars are absent

---

## Before You Build — Required Questions

Answer all of these before writing any code for a new feature:

1. Does this feature require a new env var? → Add it to the table above first.
2. Does this touch `middleware.js` or `lib/session.js`? → Plan to re-run the full
   auth test suite.
3. Does this add a new route? → Add it to the Routing table and Nav Structure above.
4. Is the new section optional (env-var-gated)? → Confirm the sidebar hides it when
   vars are absent.
5. What does the empty/error state look like? → Design it before coding the happy path.

---

## Integration Notes

### Marketing Emails (Mailchimp) — Live

- Uses the Mailchimp Reports API via `lib/mailchimp.js`
- Campaign list filtered by `MAILCHIMP_FILTER_MODE` (title substring or folder ID)
- Per-campaign report includes KPIs, send funnel, engagement-depth buckets, top
  links, high-engagement/no-click cohort, and generated plain-English takeaways
- `lib/cache.js` memoizes report + list calls (10-30 min TTLs) so the UI stays fast
- Trends view (`/emails/trends`) batches the last 30 campaigns, computes rolling
  3-send averages, and generates benchmark/variance takeaways

### Survey Responses (Zapier → Vercel Blob) — Live

- Each Zap POSTs to `/api/webhooks/form/[formId]?secret=WEBHOOK_SECRET`
- One **private** blob written per submission at `surveys/{formId}/{timestamp}.json`
- `/api/surveys/[formId]` lists blobs under the per-form prefix and reads each via
  the Vercel Blob SDK's `get(pathname, { access: "private" })`
- Survey nav items come from `WEBHOOK_FORMS` (JSON array), with a default list of
  three forms if the env var is absent
- Legacy migration: `scripts/inventory-blobs.mjs` and `scripts/migrate-blobs.mjs`
  convert the pre-refactor aggregated shape (`surveys/{formId}.json`) to the
  per-submission shape

### LinkedIn Analytics (Buffer API) — Live

- Uses the Buffer public API via `lib/buffer.js`
- One-time OAuth flow: visit `/api/auth/buffer` while logged in to authorize, the
  callback at `/api/auth/buffer/callback` displays the access token, paste it into
  Vercel as `BUFFER_API`, redeploy
- Pulls profile stats (followers) and the last 25 sent posts (impressions, clicks,
  reactions, comments, shares)
- Engagement rate computed as `(reactions + comments + shares + clicks) / impressions`
- Posts with zero impressions are excluded from average calculations but still
  contribute to total clicks

### Runbook — Live

- Static HTML at `public/runbook.html`, embedded in `/runbook` via iframe
- Content is Claude-generated and updated manually; not sensitive but still
  auth-gated (middleware applies to all static files except `/logo.jpg`)

### Events & Calendar — Static placeholder

- `components/CalendarView.jsx` renders a hardcoded `EVENTS` array
- The Microsoft Graph / Outlook integration is **not yet built** — env vars
  (`AZURE_*`, `OUTLOOK_CALENDAR_ID`) are reserved but not wired up
- Target shape when built:
  - Azure AD app registration with `Calendars.Read` application permission
  - Read from a shared Outlook calendar via `https://graph.microsoft.com/v1.0`
  - Event body = plan notes

### Website Analytics (GA4) — Coming Soon placeholder

- `/analytics/website` currently renders `<ComingSoon />`
- When built:
  - Google Analytics Data API v1 via `@googleapis/analyticsdata`
  - Service account auth (`GOOGLE_SERVICE_ACCOUNT_KEY`), service account added as
    Viewer on the GA4 property
  - Metrics: sessions, users, pageviews, bounce rate, top pages, traffic sources

### AI Narrative Summaries (Mailchimp Campaigns) — Not yet built

- Model: `claude-sonnet-4-6`
- Generates a 3–4 sentence executive summary per campaign
- Displayed as an "AI Summary" card above the KPI grid on `/emails`
- Keep prompt and token usage lean — runs on every campaign page load (cache the
  result alongside the campaign report in `lib/cache.js`)
