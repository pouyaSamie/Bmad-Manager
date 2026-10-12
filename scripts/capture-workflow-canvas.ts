import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function main() {
  const screenshotDir = "C:/Users/pouya/.gemini/antigravity/brain/dc402600-2106-4ec1-ba71-1389b1c46d2b/screenshots/workflow_canvas";
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

  // Navigate to BMad Control (/repo/local/chess-report-3aaf4293/control)
  console.log("2. Navigating to BMad Control (/repo/local/chess-report-3aaf4293/control)...");
  await page.goto("http://localhost:3002/repo/local/chess-report-3aaf4293/control", { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);

  // 1. Screenshot of the Agent Workflow Canvas Overview
  console.log("3. Capturing Agent Workflow Canvas Overview...");
  const canvasPath = path.join(screenshotDir, "01_workflow_canvas_overview.png");
  await page.screenshot({ path: canvasPath, fullPage: true });
  console.log(`Saved: ${canvasPath}`);

  // 2. Open Config Modal via Explicit Config Button on an agent node
  console.log("4. Clicking Config button on Amelia node...");
  const configButtons = page.locator('button[title*="Configure node"]');
  const count = await configButtons.count();
  console.log(`Found ${count} config buttons on nodes.`);
  if (count > 0) {
    await configButtons.nth(4).click();
    await page.waitForTimeout(1000);

    const configModalPath = path.join(screenshotDir, "02_node_config_modal.png");
    await page.screenshot({ path: configModalPath, fullPage: true });
    console.log(`Saved: ${configModalPath}`);

    // Close modal
    const closeBtn = page.locator('button:has-text("Cancel")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(600);
    }
  }

  // 3. Open Config Modal via Double-Click on Nella (Critic) node
  console.log("5. Testing Double-Click on Nella Critic node...");
  const nellaNode = page.locator('h4:has-text("Nella")').first();
  if (await nellaNode.isVisible()) {
    await nellaNode.dblclick();
    await page.waitForTimeout(1000);

    const doubleClickModalPath = path.join(screenshotDir, "03_double_click_modal.png");
    await page.screenshot({ path: doubleClickModalPath, fullPage: true });
    console.log(`Saved: ${doubleClickModalPath}`);

    // Switch to Persona tab to show End-User Advocate Callout & default persona
    const personaTab = page.locator('button:has-text("Persona & Instructions")').first();
    if (await personaTab.isVisible()) {
      await personaTab.click();
      await page.waitForTimeout(600);
      const personaModalPath = path.join(screenshotDir, "04_config_persona_tab.png");
      await page.screenshot({ path: personaModalPath, fullPage: true });
      console.log(`Saved: ${personaModalPath}`);
    }

    // Close modal
    const cancelBtn = page.locator('button:has-text("Cancel")').first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      await page.waitForTimeout(600);
    }
  }

  // 4. Capture Models & Providers Page
  console.log("6. Capturing Models & Providers page...");
  await page.goto("http://localhost:3002/repo/local/chess-report-3aaf4293/models", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const modelsPath = path.join(screenshotDir, "05_docker_models_providers.png");
  await page.screenshot({ path: modelsPath, fullPage: true });
  console.log(`Saved: ${modelsPath}`);

  await browser.close();
  console.log("Workflow Canvas screenshots captured successfully!");
}

main().catch(console.error);
