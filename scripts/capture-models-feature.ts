import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function main() {
  const screenshotDir = "C:/Users/pouya/.gemini/antigravity/brain/dc402600-2106-4ec1-ba71-1389b1c46d2b/screenshots/models_feature";
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
  });

  const page = await context.newPage();

  console.log("1. Authenticating...");
  await page.goto("http://localhost:3002/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"], input[name="email"]', "testadmin@example.com");
  await page.fill('input[type="password"], input[name="password"]', "testpassword123");
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(2000);

  // Navigate to Models & Providers page
  console.log("2. Navigating to Models & Providers page (/repo/local/chess-report-3aaf4293/models)...");
  await page.goto("http://localhost:3002/repo/local/chess-report-3aaf4293/models", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  const modelsPagePath = path.join(screenshotDir, "01_models_providers_page.png");
  await page.screenshot({ path: modelsPagePath, fullPage: true });
  console.log(`Saved: ${modelsPagePath}`);

  // Navigate to BMad Control (/repo/local/chess-report-3aaf4293/control)
  console.log("3. Navigating to BMad Control (/repo/local/chess-report-3aaf4293/control)...");
  await page.goto("http://localhost:3002/repo/local/chess-report-3aaf4293/control", { waitUntil: "networkidle" });
  await page.waitForSelector('button:has-text("Models & Providers")', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Click on "Models & Providers" tab
  const modelsTab = page.locator('button:has-text("Models & Providers")').first();
  if (await modelsTab.isVisible()) {
    console.log("Clicking Models & Providers tab...");
    await modelsTab.click();
    await page.waitForTimeout(2000);
  }

  const controlModelsPath = path.join(screenshotDir, "02_control_with_models_tab.png");
  await page.screenshot({ path: controlModelsPath, fullPage: true });
  console.log(`Saved: ${controlModelsPath}`);

  // Scroll down to Agent Routing Matrix
  console.log("4. Capturing Agent Routing Matrix...");
  const matrixElement = page.locator('text=Agent Model Overrides & Routing Matrix').first();
  if (await matrixElement.isVisible()) {
    await matrixElement.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    const routingMatrixPath = path.join(screenshotDir, "03_agent_routing_matrix.png");
    await page.screenshot({ path: routingMatrixPath, fullPage: false });
    console.log(`Saved: ${routingMatrixPath}`);
  }

  // Switch to Workflow Studio tab and select an agent to show inspector with AGY / Gemini 3.8 Flash presets
  console.log("5. Navigating to Workflow Studio tab...");
  const studioTab = page.locator('button:has-text("Workflow Studio")').first();
  if (await studioTab.isVisible()) {
    await studioTab.click();
    await page.waitForTimeout(2000);

    const ameliaCard = page.locator('h4:has-text("Amelia")').first();
    if (await ameliaCard.isVisible()) {
      await ameliaCard.click();
      await page.waitForTimeout(1500);
    }

    const inspectorPath = path.join(screenshotDir, "04_studio_inspector_agy_models.png");
    await page.screenshot({ path: inspectorPath, fullPage: true });
    console.log(`Saved: ${inspectorPath}`);
  }

  await browser.close();
  console.log("All screenshots captured successfully!");
}

main().catch(console.error);
