import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function main() {
  const screenshotDir = "C:/Users/pouya/.gemini/antigravity/brain/dc402600-2106-4ec1-ba71-1389b1c46d2b/screenshots/journey";
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  console.log("1. Logging in...");
  await page.goto("http://localhost:3002/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"], input[name="email"]', "testadmin@example.com");
  await page.fill('input[type="password"], input[name="password"]', "testpassword123");
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(2000);

  console.log("2. Capturing Dashboard with redesigned sidebar...");
  await page.screenshot({ path: path.join(screenshotDir, "journey_01_dashboard_sidebar.png") });

  console.log("3. Clicking Quick project switcher popover...");
  const switchBtn = page.locator('button[title="Quick project switcher"]').first();
  if (await switchBtn.isVisible()) {
    await switchBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, "journey_02_switch_project_modal.png") });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }

  console.log("4. Clicking inline '+' Add Project in header...");
  const addHeaderBtn = page.locator('button[title="Add new project"]').first();
  if (await addHeaderBtn.isVisible()) {
    await addHeaderBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, "journey_03_add_project_modal.png") });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }

  console.log("5. Navigating to active project (chess-report-c0e8e668)...");
  await page.goto("http://localhost:3002/repo/local/chess-report-c0e8e668", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(screenshotDir, "journey_04_active_project_sidebar.png") });

  console.log("Screenshots captured successfully!");
  await browser.close();
}

main().catch((err) => {
  console.error("Capture error:", err);
  process.exit(1);
});
