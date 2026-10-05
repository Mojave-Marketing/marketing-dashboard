const PASSWORD = "e2e-password";

async function login(page) {
  await page.goto("/login");
  await page.getByPlaceholder("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /Sign in/ }).click();
  await page.waitForURL("http://localhost:3000/");
}

// Routes that must always hit the real server even when mockApi is active,
// so the auth flow (login/logout) and public webhook endpoints keep working.
const PASSTHROUGH = ["/api/login", "/api/logout", "/api/webhooks", "/api/auth/buffer"];

// Register canned JSON responses for /api/* routes before navigating.
// Pass an object like { "/api/campaigns": { campaigns: [...] } }. Entries
// with a function value receive (route, request) and may call route.fulfill.
async function mockApi(page, routes) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (PASSTHROUGH.some((p) => path.startsWith(p))) {
      await route.continue();
      return;
    }
    const handler = routes[path];
    if (handler === undefined) {
      await route.fulfill({ status: 404, body: JSON.stringify({ error: "unmocked" }) });
      return;
    }
    if (typeof handler === "function") {
      await handler(route, route.request());
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(handler),
    });
  });
}

module.exports = { login, mockApi, PASSWORD };
