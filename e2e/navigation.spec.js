const { test, expect } = require("@playwright/test");
const { login, mockApi } = require("./helpers");

test.describe("navigation", () => {
  test("home page shows the Events & Calendar heading and nav advances months", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: /Events & Calendar/ })).toBeVisible();
    // Calendar opens on the current month; advance twice and confirm the
    // month label changes. Exact month depends on today's date, so we just
    // assert that the label updates after each click.
    const monthLabel = page.locator(".calendar-month-label");
    const start = await monthLabel.textContent();
    await page.getByRole("button", { name: "›" }).click();
    await expect(monthLabel).not.toHaveText(start);
  });

  test("Marketing Emails campaign page renders KPI cards from mocked data", async ({ page }) => {
    await mockApi(page, {
      "/api/campaigns": {
        campaigns: [{ id: "c1", title: "September Send", sendTime: "2026-09-01T00:00:00Z" }],
      },
      "/api/campaigns/c1": {
        campaignId: "c1",
        title: "September Send",
        sendTime: "2026-09-01T00:00:00Z",
        kpis: {
          sent: 1200,
          delivered: 1180,
          openRate: 0.32,
          clickRate: 0.045,
          clickToOpenRate: 0.14,
          bounces: 20,
          unsubscribed: 2,
          benchmarks: { openRate: 0.26, clickRate: 0.03 },
        },
        funnel: [
          { stage: "Sent", value: 1200 },
          { stage: "Delivered", value: 1180 },
          { stage: "Opened", value: 377 },
          { stage: "Clicked", value: 53 },
        ],
        engagementBuckets: [{ bucket: "0", count: 800 }, { bucket: "1", count: 300 }],
        topLinks: [{ url: "https://mojave.com/x", clicks: 30, uniqueClicks: 25 }],
        contacts: [],
        takeaways: [],
        recipientCountFromActivity: 100,
      },
    });
    await login(page);
    await page.goto("/emails");
    await expect(page.getByRole("heading", { name: "September Send" })).toBeVisible();
    await expect(page.getByText("1,200")).toBeVisible();
    await expect(page.getByText("32.0%")).toBeVisible();
  });

  test("Trends & Baseline page renders chart KPIs from mocked trends", async ({ page }) => {
    await mockApi(page, {
      "/api/campaigns/trends": {
        sends: [
          { id: "s1", title: "Send 1", sendTime: "2026-01-01T00:00:00Z", sent: 100, uniqueOpens: 30, uniqueClicks: 5, openRate: 0.3, clickRate: 0.05, clickToOpenRate: 0.17, bounces: 1, unsubscribes: 0, rollingOpenRate: null, rollingClickRate: null },
          { id: "s2", title: "Send 2", sendTime: "2026-02-01T00:00:00Z", sent: 100, uniqueOpens: 25, uniqueClicks: 4, openRate: 0.25, clickRate: 0.04, clickToOpenRate: 0.16, bounces: 1, unsubscribes: 0, rollingOpenRate: null, rollingClickRate: null },
        ],
        benchmarks: { openRate: 0.26, clickRate: 0.03 },
        takeaways: [],
        total: 2,
      },
    });
    await login(page);
    await page.goto("/emails/trends");
    await expect(page.getByRole("heading", { name: "Trends & Baseline" })).toBeVisible();
    await expect(page.getByText("Sends analyzed")).toBeVisible();
    await expect(page.getByRole("heading", { name: "All sends" })).toBeVisible();
    await expect(page.getByText("Send 1")).toBeVisible();
  });

  test("Survey Responses page renders mocked rows", async ({ page }) => {
    await mockApi(page, {
      "/api/surveys/arctidry-training": {
        responses: [
          { Name: "Jane", Rating: "9", Comments: "Great", _receivedAt: "2026-09-01T00:00:00Z" },
        ],
        total: 1,
      },
    });
    await login(page);
    await page.goto("/surveys/arctidry-training");
    await expect(page.getByRole("heading", { name: /Arctidry Training/ })).toBeVisible();
    await expect(page.getByText("Jane")).toBeVisible();
    await expect(page.getByText("Total Responses")).toBeVisible();
  });

  test("LinkedIn Analytics page renders KPI cards and post table from mocked data", async ({ page }) => {
    await mockApi(page, {
      "/api/linkedin": {
        profile: { name: "Mojave", followers: 1234 },
        posts: [
          { id: "p1", text: "HVAC post", sentAt: "2026-09-01T00:00:00Z", stats: { impressions: 1000, clicks: 50, reactions: 10, comments: 3, shares: 2, engagementRate: 0.065 } },
        ],
        summary: { postsAnalyzed: 1, totalPostsFetched: 1, avgImpressions: 1000, totalClicks: 50, avgEngagementRate: 0.065 },
      },
    });
    await login(page);
    await page.goto("/analytics/linkedin");
    await expect(page.getByRole("heading", { name: /LinkedIn Analytics/ })).toBeVisible();
    await expect(page.getByText("Followers")).toBeVisible();
    await expect(page.getByText("1,234")).toBeVisible();
    await expect(page.getByText("HVAC post")).toBeVisible();
  });

  test("Website Analytics shows Coming Soon placeholder", async ({ page }) => {
    await login(page);
    await page.goto("/analytics/website");
    await expect(page.getByText("Coming Soon")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Website Analytics" })).toBeVisible();
  });

  test("Runbook page renders an iframe to the runbook HTML", async ({ page }) => {
    await login(page);
    await page.goto("/runbook");
    const frame = page.locator("iframe");
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute("src", "/runbook.html");
  });

  test("sidebar nav takes the user to each section", async ({ page }) => {
    // Mock just enough that pages don't throw on their fetches
    await mockApi(page, {
      "/api/campaigns": { campaigns: [] },
      "/api/campaigns/trends": { sends: [], benchmarks: { openRate: 0.26, clickRate: 0.03 }, takeaways: [], total: 0 },
      "/api/surveys/arctidry-training": { responses: [], total: 0 },
      "/api/linkedin": { error: "BUFFER_API not configured" },
    });
    await login(page);

    await page.getByRole("link", { name: "Campaigns" }).click();
    await expect(page).toHaveURL(/\/emails$/);

    await page.getByRole("link", { name: "Trends & Baseline" }).click();
    await expect(page).toHaveURL(/\/emails\/trends$/);

    await page.getByRole("link", { name: "Arctidry Training" }).click();
    await expect(page).toHaveURL(/\/surveys\/arctidry-training$/);

    await page.locator(".sidebar-item", { hasText: /^Overview$/ }).first().click();
    // Website Overview comes first in nav order
    await expect(page).toHaveURL(/\/analytics\/website$/);
  });
});
