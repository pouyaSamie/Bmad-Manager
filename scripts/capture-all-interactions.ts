import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function main() {
  const screenshotDir = "C:/Users/pouya/.gemini/antigravity/brain/dc402600-2106-4ec1-ba71-1389b1c46d2b/screenshots";
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  console.log("Logging in...");
  await page.goto("http://localhost:3002/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "testadmin@example.com");
  await page.fill('input[type="password"]', "testpassword123");
  await page.click('button[type="submit"]', { force: true });
  await page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);

  console.log("Navigating to control overview...");
  await page.goto("http://localhost:3002/repo/local/chess-report-c0e8e668/control", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  // 1. Overview screenshot
  console.log("Capturing 02_control_overview.png...");
  await page.screenshot({ path: path.join(screenshotDir, "02_control_overview.png"), fullPage: true });

  // 2. Click Skills tab in palette
  console.log("Clicking Skills tab in palette...");
  const skillsTab = page.locator('button:has-text("Skills (")');
  if (await skillsTab.isVisible()) {
    await skillsTab.click({ force: true });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, "04_skills_palette.png") });
    // Switch back to Agents tab in palette
    const agentsTab = page.locator('button:has-text("Agents (")');
    if (await agentsTab.isVisible()) await agentsTab.click({ force: true });
    await page.waitForTimeout(500);
  }

  // 3. Click Inspect on Stage 01
  console.log("Clicking Inspect on Stage 01...");
  const inspectBtn = page.locator('button[title="Inspect agent persona & settings"]').first();
  if (await inspectBtn.isVisible()) {
    await inspectBtn.click({ force: true });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, "05_agent_inspector.png") });
  }

  // 4. Click Add Feedback Loop
  console.log("Clicking Add Feedback Loop...");
  const addLoopBtn = page.locator('button:has-text("Add Feedback Loop")');
  if (await addLoopBtn.isVisible()) {
    await addLoopBtn.click({ force: true });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, "06_add_loop_modal.png") });
    // Close modal
    const closeBtn = page.locator('button:has-text("Cancel")');
    if (await closeBtn.isVisible()) await closeBtn.click({ force: true });
    await page.waitForTimeout(500);
  }

  // 5. Test Rapid Dev Spike preset
  console.log("Testing Rapid Dev Spike preset...");
  const rapidPreset = page.locator('button:has-text("Rapid")');
  if (await rapidPreset.isVisible()) {
    await rapidPreset.click({ force: true });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, "07_rapid_preset.png") });
  }

  // Switch back to BMad Standard preset
  const bmadPreset = page.locator('button:has-text("BMad")');
  if (await bmadPreset.isVisible()) {
    await bmadPreset.click({ force: true });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, "08_bmad_standard_preset.png"), fullPage: true });
  }

  console.log("All interaction screenshots captured successfully!");
  await browser.close();
}

main().catch(console.error);
