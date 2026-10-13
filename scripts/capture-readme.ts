import "dotenv/config";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
async function main() {
  const base = process.env.QA_BASE_URL ?? "http://localhost:3002";
  const project = process.env.QA_PROJECT_PATH;
  const email = process.env.QA_EMAIL,
    password = process.env.QA_PASSWORD;
  if (!project || !email || !password)
    throw new Error(
      "Set QA_PROJECT_PATH, QA_EMAIL, and QA_PASSWORD before capture",
    );
  if (!/^\/repo\/[^/]+\/[^/?#]+$/.test(project))
    throw new Error("Use a project path such as /repo/local/my-project");
  const output = path.resolve("docs/screenshots");
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    executablePath:
      process.env.QA_BROWSER ??
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.on("dialog", async (d) => {
    await d.accept();
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  async function visit(route: string) {
    await page.goto(base + route);
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    await page.waitForTimeout(800);
  }
  async function snap(name: string) {
    await page.screenshot({ path: path.join(output, name + ".png") });
  }
  async function theme(value: string) {
    await page.evaluate(
      (t) => localStorage.setItem("mantine-color-scheme-value", t),
      value,
    );
    await page.reload();
    await page.waitForTimeout(800);
  }
  try {
    await page.goto(base + "/login");
    await page.locator("input[type=email]").fill(email);
    await page.locator("input[type=password]").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(base + "/");
    await theme("light");
    await snap("projects");
    await visit(project);
    await page.getByRole("heading",{name:"Project setup",exact:true}).waitFor({timeout:20000});
    await snap("overview");
    await visit(project + "/agents");
    await page
      .getByRole("button", { name: "Configure and test" })
      .first()
      .waitFor();
    await snap("agents");
    await page
      .getByRole("button", { name: "Configure and test" })
      .first()
      .click();
    await page
      .getByRole("combobox", { name: "Connection", exact: true })
      .click();
    const codex = page.getByRole("option", { name: "Codex CLI", exact: true });
    if (await codex.count()) {
      await codex.click();
      await page.getByRole("combobox", { name: "Model", exact: true }).click();
      await page.getByRole("option").first().click();
    } else await page.keyboard.press("Escape");
    await snap("agent-inspector");
    await page.keyboard.press("Escape");
    await visit(project + "/workflow");
    await theme("dark");
    await page
      .getByRole("button", { name: "Manager 7-agent preset", exact: true })
      .click();
    await page.getByRole("button", { name: "Fit view", exact: true }).click();
    await page.waitForTimeout(800);
    await snap("workflow");
    await visit("/connections");
    await theme("light");
    await snap("connections");
    await visit("/diagnostics");
    await snap("diagnostics");
    await visit(project + "/docs");
    const document = page.getByRole("button", { name: /^epics\.md/ });
    if (await document.count()) {
      await document.first().click();
      await page
        .getByText("Loading artifact…", { exact: true })
        .waitFor({ state: "hidden" });
    }
    await page.waitForTimeout(600);
    await snap("library");
    await visit(project + "/stories");
    await page
      .getByRole("textbox", { name: "Search", exact: true })
      .fill("opening");
    await snap("stories");
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.waitForTimeout(600);
    await snap("mobile");
    if (errors.length) throw new Error("Browser errors: " + errors.join("; "));
    await fs.writeFile(
      path.join(output, "capture.json"),
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          base,
          project,
          tool: "Playwright",
          desktop: { width: 1440, height: 1000 },
          mobile: { width: 390, height: 1000 },
          workflow: "Unsaved Manager preset preview",
          errors,
        },
        null,
        2,
      ) + "\n",
    );
    console.log("Captured ten README images without saving project changes.");
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
