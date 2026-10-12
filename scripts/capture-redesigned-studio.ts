import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function main() {
  const screenshotDir = "C:/Users/pouya/.gemini/antigravity/brain/dc402600-2106-4ec1-ba71-1389b1c46d2b/screenshots/redesigned_studio";
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

  console.log("2. Clicking project from sidebar...");
  const projectLink = page.locator('span:has-text("chess-report")').first();
  await projectLink.click();
  await page.waitForTimeout(1500);

  // Click BMad Control in sidebar
  console.log("3. Navigating to BMad Control...");
  const bmadControlNav = page.locator('a:has-text("BMad Control")').first();
  if (await bmadControlNav.isVisible()) {
    await bmadControlNav.click();
  } else {
    // Navigate via URL
    console.log("Navigating directly to current URL + /control...");
    const url = page.url();
    await page.goto(`${url.replace(/\/$/, "")}/control`);
  }

  await page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(3000);

  // 1. Overview Full Studio with Delivery Flow
  console.log("4. Capturing Redesigned Delivery Flow & Loops...");
  const flowPath = path.join(screenshotDir, "01_studio_delivery_flow.png");
  await page.screenshot({ path: flowPath, fullPage: true });
  console.log(`Saved: ${flowPath}`);

  // 2. Select Amelia card to open Right Inspector Drawer
  console.log("5. Selecting Amelia card for Inspector Drawer...");
  const ameliaCard = page.locator('h4:has-text("Amelia")').first();
  if (await ameliaCard.isVisible()) {
    await ameliaCard.click();
    await page.waitForTimeout(1000);

    const inspectorModelPath = path.join(screenshotDir, "02_inspector_agent_model_route.png");
    await page.screenshot({ path: inspectorModelPath, fullPage: true });
    console.log(`Saved: ${inspectorModelPath}`);

    // Switch to Persona tab
    const personaTab = page.locator('button:has-text("Persona & Prompts")');
    if (await personaTab.isVisible()) {
      await personaTab.click();
      await page.waitForTimeout(500);

      const inspectorPersonaPath = path.join(screenshotDir, "03_inspector_agent_persona.png");
      await page.screenshot({ path: inspectorPersonaPath, fullPage: true });
      console.log(`Saved: ${inspectorPersonaPath}`);
    }
  } else {
    console.log("Amelia card not visible!");
  }

  // 3. Select a feedback loop to open Loop Inspector
  console.log("6. Selecting a feedback loop...");
  const loopCard = page.locator('span:has-text("VERDICTS")').first();
  if (await loopCard.isVisible()) {
    await loopCard.click();
    await page.waitForTimeout(800);

    const loopInspectorPath = path.join(screenshotDir, "04_loop_inspector_drawer.png");
    await page.screenshot({ path: loopInspectorPath, fullPage: true });
    console.log(`Saved: ${loopInspectorPath}`);
  }

  // 4. Switch to Sequence Track View
  console.log("7. Switching to Pipeline Sequence view...");
  const seqBtn = page.locator('button:has-text("Pipeline Sequence")');
  if (await seqBtn.isVisible()) {
    await seqBtn.click();
    await page.waitForTimeout(1000);

    const seqPath = path.join(screenshotDir, "05_studio_pipeline_sequence.png");
    await page.screenshot({ path: seqPath, fullPage: true });
    console.log(`Saved: ${seqPath}`);
  }

  await browser.close();
  console.log("All screenshots captured successfully!");
}

main().catch(console.error);
