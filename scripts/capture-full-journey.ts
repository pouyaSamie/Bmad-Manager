import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function main() {
  const screenshotDir = "C:/Users/pouya/.gemini/antigravity/brain/dc402600-2106-4ec1-ba71-1389b1c46d2b/screenshots/full_journey";
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1536, height: 960 },
  });

  const page = await context.newPage();

  console.log("Stage 1: Login & Authentication...");
  await page.goto("http://localhost:3002/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"], input[name="email"]', "testadmin@example.com");
  await page.fill('input[type="password"], input[name="password"]', "testpassword123");
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(2000);

  console.log("Stage 2: Dashboard Portfolio View...");
  await page.screenshot({ path: path.join(screenshotDir, "01_portfolio_dashboard.png"), fullPage: true });

  console.log("Stage 3: Add Project & BMAD Wizard Onboarding...");
  const addProjectBtn = page.locator('button[title="Add new project"]').first();
  if (await addProjectBtn.isVisible()) {
    await addProjectBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, "02_add_project_wizard.png") });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }

  console.log("Stage 4: Project Overview & Velocity Metrics...");
  await page.goto("http://localhost:3002/repo/local/chess-report-c0e8e668", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(screenshotDir, "03_project_overview.png"), fullPage: true });

  console.log("Stage 5: Planning Artifacts & Epics Tracking...");
  await page.goto("http://localhost:3002/repo/local/chess-report-c0e8e668/epics", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(screenshotDir, "04_epics_tracking.png"), fullPage: true });

  console.log("Stage 6: Implementation & Stories Delivery Board...");
  await page.goto("http://localhost:3002/repo/local/chess-report-c0e8e668/stories", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(screenshotDir, "05_stories_delivery_board.png"), fullPage: true });

  console.log("Stage 7: Library & Architecture Documentation...");
  await page.goto("http://localhost:3002/repo/local/chess-report-c0e8e668/docs", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(screenshotDir, "06_docs_library.png"), fullPage: true });

  console.log("Stage 8: BMad Control & Workflow Studio (Pipeline & Stages on Overview)...");
  await page.goto("http://localhost:3002/repo/local/chess-report-c0e8e668/control", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(screenshotDir, "07_workflow_studio_pipeline.png"), fullPage: true });

  console.log("Stage 9: Workflow Studio Skills Palette...");
  const skillsTab = page.locator('button:has-text("Skills Library"), [role="tab"]:has-text("Skills Library")').first();
  if (await skillsTab.isVisible()) {
    await skillsTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, "08_workflow_studio_skills.png"), fullPage: true });
  }

  console.log("Stage 10: Feedback Loop Architecture Modal...");
  const addLoopBtn = page.locator('button:has-text("Add Loop"), button:has-text("Add feedback loop")').first();
  if (await addLoopBtn.isVisible()) {
    await addLoopBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, "09_feedback_loop_modal.png") });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }

  console.log("Stage 11: Agent Customization Inspector...");
  const agentsNavBtn = page.locator('button:has-text("Agents")').first();
  if (await agentsNavBtn.isVisible()) {
    await agentsNavBtn.click();
    await page.waitForTimeout(1000);
    const customizeBtn = page.locator('button:has-text("Customize")').first();
    if (await customizeBtn.isVisible()) {
      await customizeBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(screenshotDir, "10_agent_customization_modal.png") });
    }
  }

  console.log("Full user journey captured successfully!");
  await browser.close();
}

main().catch((err) => {
  console.error("Capture error:", err);
  process.exit(1);
});
