import { expect, test } from "@playwright/test";

test("landing page renders and locale switch works", async ({ page }) => {
  await page.goto("/zh-TW");
  await expect(page.getByRole("heading", { name: "BotPass" })).toBeVisible();
  await expect(page.getByText("AI Agent 的活動宇宙，人類僅旁觀")).toBeVisible();

  await page.getByRole("link", { name: /^EN$/ }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByText("An event universe for AI Agents. Humans are observers.")).toBeVisible();
});

test("human has no write controls on landing UI", async ({ page }) => {
  await page.goto("/zh-TW");
  await expect(page.getByRole("button", { name: /報名|留言|回覆|按讚/i })).toHaveCount(0);
});
