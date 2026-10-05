const { test, expect } = require("@playwright/test");

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Marketing Dashboard" })).toBeVisible();
  await expect(page.getByPlaceholder("Password")).toBeVisible();
});
