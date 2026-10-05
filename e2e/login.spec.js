const { test, expect } = require("@playwright/test");
const { login, PASSWORD } = require("./helpers");

test.describe("auth", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Marketing Dashboard" })).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
  });

  test("unauthenticated visit to / redirects to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("unauthenticated visit to /emails redirects to /login", async ({ page }) => {
    await page.goto("/emails");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("unauthenticated visit to /surveys/foo redirects to /login", async ({ page }) => {
    await page.goto("/surveys/arctidry-training");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("wrong password shows an error on the login page", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Password").fill("not-the-right-password");
    await page.getByRole("button", { name: /Sign in/ }).click();
    await expect(page.getByText(/Incorrect password/)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("correct password lands on the home page", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL("http://localhost:3000/");
    await expect(page.getByRole("heading", { name: /Events & Calendar/ })).toBeVisible();
  });

  test("logout clears session and returns to /login", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: /Log out/ }).click();
    await expect(page).toHaveURL(/\/login$/);
    // Second visit to a protected route still redirects.
    await page.goto("/emails");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("/logo.jpg loads without a session (regression)", async ({ page }) => {
    const res = await page.goto("/logo.jpg");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/image/);
  });

  test("session persists across navigations", async ({ page }) => {
    await login(page);
    await page.goto("/surveys/arctidry-training");
    await expect(page).toHaveURL(/\/surveys\/arctidry-training$/);
  });
});
