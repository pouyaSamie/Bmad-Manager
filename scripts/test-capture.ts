import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function main() {
  const screenshotDir = "C:/Users/pouya/.gemini/antigravity/brain/dc402600-2106-4ec1-ba71-1389b1c46d2b/screenshots";
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

  console.log("Navigating to login...");
  await page.goto("http://localhost:3002/login", { waitUntil: "networkidle" });

  console.log("Filling login credentials...");
  await page.fill('input[type="email"], input[name="email"]', "testadmin@example.com");
  await page.fill('input[type="password"], input[name="password"]', "testpassword123");
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(2000);

  console.log("Current URL:", page.url());
  await page.screenshot({ path: path.join(screenshotDir, "01_dashboard.png") });

  console.log("Navigating to control page for chess-report-c0e8e668...");
  await page.goto("http://localhost:3002/repo/local/chess-report-c0e8e668/control", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: path.join(screenshotDir, "02_control_overview.png"), fullPage: true });

  // Switch to Agents tab if available
  const agentsTab = page.locator('button:has-text("Agents"), [role="tab"]:has-text("Agents")').first();
  if (await agentsTab.isVisible()) {
    await agentsTab.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(screenshotDir, "03_control_agents.png"), fullPage: true });
  }

  console.log("Screenshots captured successfully!");
  await browser.close();
}

main().catch((err) => {
  console.error("Capture error:", err);
  process.exit(1);
});
