import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("console", (msg) => console.log("PAGE LOG:", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err));

  await page.goto("http://localhost:3002/login");
  await page.fill('input[type="email"]', "testadmin@example.com");
  await page.fill('input[type="password"]', "testpassword123");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  console.log("Navigating to /repo/local/chess-report-c0e8e668/control");
  await page.goto("http://localhost:3002/repo/local/chess-report-c0e8e668/control");
  await page.waitForTimeout(3000);

  const errorOverlay = await page.locator("nextjs-portal, [data-nextjs-dialog-header]").allInnerTexts().catch(() => []);
  console.log("Error overlays:", errorOverlay);

  const text = await page.evaluate(() => document.body.innerText);
  console.log("Body text preview:\n", text);

  await browser.close();
}

main().catch(console.error);
