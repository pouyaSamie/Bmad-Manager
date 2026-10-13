import "dotenv/config";
import { config } from "dotenv";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { prisma } from "../src/lib/db/client";
import { parse } from "smol-toml";
async function main() {
  config({ path: ".env.bridge.local", quiet: true });
  const base = process.env.QA_BASE_URL ?? "http://localhost:3002";
  const workspace = process.env.QA_WORKSPACE ?? "C:/workspace";
  const stamp = Date.now().toString();
  const folder = await fs.mkdtemp(path.join(workspace, ".bmad-manager-qa-"));
  const screenshots = path.resolve(".qa-results", stamp);
  await fs.mkdir(screenshots, { recursive: true });
  const email = process.env.QA_EMAIL ?? "testadmin@example.com",
    password = process.env.QA_PASSWORD ?? "testpassword123";
  let projectId: string | undefined, connectionId: string | undefined;
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
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const server = http.createServer(async (req, res) => {
    if (req.url === "/v1/models") {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          data: [{ id: "fixture-model", name: "Fixture model" }],
        }),
      );
      return;
    }
    if (req.url === "/v1/chat/completions") {
      let body = "";
      for await (const c of req) body += c;
      const payload = JSON.parse(body);
      res.writeHead(200, { "content-type": "text/event-stream" });
      const text = payload.messages.at(-1).content.includes("slow")
        ? "Slow fixture response"
        : "Fixture reply";
      for (const ch of text) {
        if (res.destroyed) break;
        res.write(
          "data: " +
            JSON.stringify({ choices: [{ delta: { content: ch } }] }) +
            "\n\n",
        );
        await new Promise((r) => setTimeout(r, 20));
      }
      if (payload.messages.at(-1).content.includes("slow"))
        await new Promise((r) => setTimeout(r, 5000));
      if (payload.messages.at(-1).content.includes("fail"))
        res.end('data: {"error":{"message":"Fixture stream failed"}}\n\n');
      else res.end("data: [DONE]\n\n");
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(3010, "0.0.0.0", resolve));
  async function choose(label: string, value: string) {
    await page.getByRole("combobox", { name: label, exact: true }).click();
    await page.getByRole("option", { name: value, exact: true }).click();
  }
  async function worker(id: string) {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          "node_modules/tsx/dist/cli.mjs",
          "scripts/bmad-worker.ts",
          "--operation-id",
          id,
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            LOCAL_WORKSPACE_PATH: "/workspace",
            LOCAL_HOST_WORKSPACE: workspace,
          },
          windowsHide: true,
          stdio: "pipe",
        },
      );
      child.stdout.resume();
      child.stderr.on("data", (b) => console.log(String(b).slice(0, 300)));
      child.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error("Worker exited " + code)),
      );
    });
    const op = await prisma.bmadOperation.findUnique({ where: { id } });
    if (op) assert.equal(op.status, "succeeded", op.error ?? "Worker failed");
  }
  try {
    await fs.mkdir(path.join(folder, "_bmad/custom"), { recursive: true });
    await fs.mkdir(path.join(folder, "_bmad-output/planning-artifacts"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(folder, "_bmad/config.toml"),
      '[agents.bmad-agent-dev]\nname="Amelia"\ntitle="Developer"\nskill="bmad-agent-dev"\n[agents.bmad-agent-pm]\nname="John"\ntitle="Product manager"\nskill="bmad-agent-pm"\n',
    );
    for (const skill of ["bmad-agent-dev", "bmad-agent-pm"]) {
      await fs.mkdir(path.join(folder, ".agents/skills", skill, "templates"), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(folder, ".agents/skills", skill, "SKILL.md"),
        "---\nname: " +
          skill +
          "\ndescription: Fixture skill\n---\nKeep conversations brief.",
      );
      await fs.writeFile(
        path.join(folder, ".agents/skills", skill, "customize.toml"),
        '[agent]\nidentity="Fixture identity"\n',
      );
      await fs.writeFile(
        path.join(folder, ".agents/skills", skill, "templates/example.md"),
        "Preserved resource",
      );
    }
    await fs.writeFile(
      path.join(folder, "source.ts"),
      "export const untouched = true;",
    );
    await fs.mkdir(path.join(folder, ".git"));
    await fs.writeFile(
      path.join(folder, ".git", "fixture-marker"),
      "Preserved Git data",
    );
    await fs.writeFile(
      path.join(folder, "_bmad-output/planning-artifacts/brief.md"),
      "# Fixture brief\n\nA readable project brief.",
    );
    await page.goto(base + "/login");
    await page.locator("input[type=email]").fill(email);
    await page.locator("input[type=password]").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(base + "/");
    console.log("PASS sign-in");
    await page
      .getByRole("button", { name: "Add project", exact: true })
      .first()
      .click();
    await page
      .getByRole("textbox", { name: "Folder path", exact: true })
      .fill(folder);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Review", exact: true }).click();
    await page
      .getByRole("button", { name: "Import project", exact: true })
      .click();
    await page.waitForURL("**/settings");
    await page.getByRole("heading", { name: "Project settings" }).waitFor();
    const project = await prisma.repo.findFirstOrThrow({
      where: { displayName: path.basename(folder), user: { email } },
    });
    projectId = project.id;
    const projectBase = "/repo/" + project.owner + "/" + project.name;
    assert.equal(
      await prisma.bmadOperation.count({
        where: { runtime: { repoId: project.id }, kind: "install" },
      }),
      0,
    );
    console.log("PASS existing installation import without installer");
    await page.goto(base + "/connections");
    await page
      .getByRole("button", { name: "Add connection", exact: true })
      .click();
    await choose("Provider", "Custom endpoint");
    await page
      .getByRole("textbox", { name: "Connection name", exact: true })
      .fill("QA fixture " + stamp);
    await page
      .getByRole("textbox", { name: "Endpoint", exact: true })
      .fill(
        base.includes("3002")
          ? "http://host.docker.internal:3010/v1"
          : "http://localhost:3010/v1",
      );
    await page
      .getByRole("button", { name: "Save and discover models", exact: true })
      .click();
    await page.getByText("1 discovered models").waitFor();
    const connection = await prisma.bmadConnection.findFirstOrThrow({
      where: { name: "QA fixture " + stamp, userId: project.userId },
    });
    connectionId = connection.id;
    await page.goto(base + projectBase + "/agents");
    await page
      .getByRole("button", { name: "Configure and test" })
      .first()
      .click();
    await choose("Connection", "QA fixture " + stamp);
    await choose("Model", "Fixture model");
    await page.getByRole("button", { name: "Save model assignment" }).click();
    await page.getByText(/Model assignment saved/).waitFor();
    await page.getByRole("tab", { name: "Test chat", exact: true }).click();
    await page.getByRole("button", { name: "Send test message" }).click();
    await page.getByText("Fixture reply", { exact: true }).waitFor();
    await page.getByText(/preview.*[0-9]+\.[0-9]+s/).waitFor();
    await page
      .getByRole("button", { name: "Stop", exact: true })
      .waitFor({ state: "hidden" });
    console.log("PASS catalog, assignment, streamed conversation");
    const sessionConversation = await prisma.bmadConversation.findFirstOrThrow({
      where: { runtime: { repoId: project.id } },
      orderBy: { createdAt: "desc" },
    });
    const secondAgent = await prisma.bmadAgent.findFirstOrThrow({
      where: { runtime: { repoId: project.id }, name: "John" },
    });
    await prisma.bmadAgent.update({
      where: { id: secondAgent.id },
      data: { connectionId: connection.id, modelId: "fixture-model" },
    });
    const mismatch = await page.request.post(base + "/api/bmad/chat", {
      data: {
        owner: project.owner,
        name: project.name,
        agentId: secondAgent.id,
        conversationId: sessionConversation.id,
        message: "Unauthorized conversation reuse",
      },
    });
    assert.equal(mismatch.status(), 404);
    const anonymous = await browser.newContext();
    const denied = await anonymous.request.post(base + "/api/bmad/chat", {
      data: {
        owner: project.owner,
        name: project.name,
        agentId: secondAgent.id,
        message: "Unauthorized request",
      },
    });
    assert.equal(denied.status(), 401);
    await anonymous.close();
    console.log("PASS conversation binding and authentication");
    await page
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("slow response");
    await page.getByRole("button", { name: "Send test message" }).click();
    await page.getByText("Slow fixture response", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Stop", exact: true }).click();
    await page
      .getByText("Conversation stopped. Partial output is retained.")
      .waitFor();
    await new Promise((r) => setTimeout(r, 500));
    const cancelled = await prisma.bmadMessage.findFirstOrThrow({
      where: { conversationId: sessionConversation.id, role: "assistant" },
      orderBy: { createdAt: "desc" },
    });
    assert.equal(cancelled.status, "cancelled");
    assert.ok(cancelled.content.length > 0);
    await page
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("fail response");
    await page.getByRole("button", { name: "Send test message" }).click();
    await page.getByText("failed", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Stop", exact: true })
      .waitFor({ state: "hidden" });
    const failed = await prisma.bmadMessage.findFirstOrThrow({
      where: { conversationId: sessionConversation.id, role: "assistant" },
      orderBy: { createdAt: "desc" },
    });
    assert.equal(failed.status, "failed");
    assert.ok(failed.content.length > 0);
    console.log(
      "PASS cancellation and streaming failure preserve partial responses",
    );
    const realConnection = await prisma.bmadConnection.findFirst({
      where: {
        userId: project.userId,
        provider: "codex-cli",
        name: "Codex CLI",
      },
    });
    if (
      realConnection &&
      (realConnection.models as { id: string; name: string }[] | null)?.length
    ) {
      await page.getByRole("tab", { name: "Model", exact: true }).click();
      await choose("Connection", realConnection.name);
      const realModel = (
        realConnection.models as { id: string; name: string }[]
      )[0];
      await choose("Model", realModel.name);
      await page.getByRole("tab", { name: "Test chat", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Message", exact: true })
        .fill("Reply only Ready. Do not use tools.");
      await page.getByRole("button", { name: "Send test message" }).click();
      await page
        .getByText(/Codex CLI.*preview.*[0-9]+\.[0-9]+s/)
        .waitFor({ timeout: 60000 });
      await page
        .getByRole("button", { name: "Stop", exact: true })
        .waitFor({ state: "hidden", timeout: 60000 });

      assert.equal(
        (
          await prisma.bmadConnection.findUniqueOrThrow({
            where: { id: realConnection.id },
          })
        ).status,
        "tested",
      );
      console.log(
        "PASS real Codex UI conversation using unsaved model preview",
      );
    } else console.log("UNVERIFIED real Codex UI: no configured connection");

    await page.keyboard.press("Escape");
    await page.goto(base + projectBase + "/agents");
    const before = await prisma.bmadAgent.findFirstOrThrow({
      where: { runtime: { repoId: project.id }, name: "Amelia" },
    });
    await page.getByRole("button", { name: "Inspect installation" }).click();
    await page.getByRole("button", { name: "Inspect installation" }).waitFor();
    const after = await prisma.bmadAgent.findUniqueOrThrow({
      where: { id: before.id },
    });
    assert.equal(after.connectionId, connection.id);
    assert.equal(after.available, true);
    console.log("PASS rescan preserves agent identity and route");
    await page.goto(base + projectBase + "/workflow");
    await page
      .getByRole("button", { name: "Add connection", exact: true })
      .click();
    await choose("From agent", "John");
    await choose("To agent", "Amelia");
    await choose("Connection type", "Feedback loop");
    await choose("Trigger", "findings");
    await page
      .getByLabel("Iteration limit (design setting)", { exact: true })
      .fill("5");
    await page.getByRole("button", { name: "Save in design" }).click();
    await page.getByRole("button", { name: "Draft workflow change" }).click();
    await page.getByText(/Design drafted/).waitFor();
    await page.goto(base + projectBase + "/settings");
    await page.getByRole("button", { name: "Approve change" }).first().click();
    await page
      .getByText("Queued for the worker. Awaiting application.", {
        exact: true,
      })
      .waitFor();
    const op = await prisma.bmadOperation.findFirstOrThrow({
      where: {
        runtime: { repoId: project.id },
        kind: "set_workflow",
        status: "queued",
      },
      orderBy: { createdAt: "desc" },
    });
    await worker(op.id);
    const saved = parse(
      await fs.readFile(
        path.join(folder, "_bmad/custom/workflow.toml"),
        "utf8",
      ),
    );
    assert.ok(JSON.stringify(saved).includes("findings"));
    assert.ok(JSON.stringify(saved).includes("5"));
    console.log("PASS graph draft, approval, worker, loop persistence");
    await page.goto(base + projectBase + "/agents");
    await page
      .getByRole("button", { name: "Configure and test" })
      .first()
      .click();
    await page.getByRole("tab", { name: "Persona", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Identity and instructions" })
      .fill("Verified fixture persona");
    await page.getByRole("button", { name: "Draft customization" }).click();
    await page.getByText(/Customization drafted/).waitFor();
    await page.keyboard.press("Escape");
    await page.goto(base + projectBase + "/settings");
    await page.getByRole("button", { name: "Approve change" }).first().click();
    await page
      .getByText("Queued for the worker. Awaiting application.", {
        exact: true,
      })
      .waitFor();
    const custom = await prisma.bmadOperation.findFirstOrThrow({
      where: {
        runtime: { repoId: project.id },
        kind: "customize_agent",
        status: "queued",
      },
    });
    await worker(custom.id);
    const behavior = parse(
      await fs.readFile(
        path.join(folder, "_bmad/custom/bmad-agent-dev.toml"),
        "utf8",
      ),
    );
    assert.equal(
      (behavior.agent as { identity: string }).identity,
      "Verified fixture persona",
    );
    assert.equal(
      await fs.readFile(
        path.join(folder, ".agents/skills/bmad-agent-dev/SKILL.md"),
        "utf8",
      ),
      "---\nname: bmad-agent-dev\ndescription: Fixture skill\n---\nKeep conversations brief.",
    );
    console.log("PASS per-skill customization and vendor protection");
    await page.goto(base + projectBase + "/agents");
    await page.getByRole("tab", { name: /Skill library/ }).click();
    await page
      .getByRole("button", { name: "Create managed copy" })
      .first()
      .click();
    await page
      .getByRole("textbox", { name: "Unique slug" })
      .fill("fixture-copy");
    await page
      .getByRole("button", { name: "Create draft", exact: true })
      .click();
    await page.getByText(/Draft created/).waitFor();
    await page.goto(base + projectBase + "/settings");
    await page.getByRole("button", { name: "Approve change" }).first().click();
    await page
      .getByText("Queued for the worker. Awaiting application.", {
        exact: true,
      })
      .waitFor();
    const clone = await prisma.bmadOperation.findFirstOrThrow({
      where: {
        runtime: { repoId: project.id },
        kind: "clone_skill",
        status: "queued",
      },
    });
    await worker(clone.id);
    assert.equal(
      await fs.readFile(
        path.join(folder, ".agents/skills/fixture-copy/templates/example.md"),
        "utf8",
      ),
      "Preserved resource",
    );
    console.log("PASS managed clone preserves supporting resources");
    const checks = [];
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (t) => localStorage.setItem("mantine-color-scheme-value", t),
          theme,
        );
        for (const section of ["agents", "workflow", "settings", "docs"]) {
          await page.goto(base + projectBase + "/" + section);
          await page.getByRole("heading", { level: 1 }).first().waitFor();
          await page.waitForTimeout(200);
          const dimensions = await page.evaluate(() => ({
            width: innerWidth,
            scroll: document.documentElement.scrollWidth,
          }));
          assert.ok(
            dimensions.scroll <= dimensions.width + 1,
            section + " overflow " + JSON.stringify(dimensions),
          );
          checks.push({ width, theme, section });
          await page.screenshot({
            path: path.join(
              screenshots,
              section + "-" + width + "-" + theme + ".png",
            ),
          });
        }
      }
    }
    console.log("PASS responsive/theme checks: " + checks.length);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + projectBase + "/settings");
    await page
      .getByRole("button", { name: "Remove project", exact: true })
      .click();
    await choose("Removal option", "Draft full BMad uninstall");
    await page
      .getByRole("button", { name: "Draft uninstall", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Refresh status", exact: true })
      .click();
    await page.getByRole("button", { name: "Approve change" }).first().click();
    await page
      .getByText("Queued for the worker. Awaiting application.", {
        exact: true,
      })
      .waitFor();
    const uninstall = await prisma.bmadOperation.findFirstOrThrow({
      where: {
        runtime: { repoId: project.id },
        kind: "uninstall",
        status: "queued",
      },
    });
    await worker(uninstall.id);
    assert.equal(await prisma.repo.count({ where: { id: project.id } }), 0);
    assert.equal(
      await fs.readFile(path.join(folder, "source.ts"), "utf8"),
      "export const untouched = true;",
    );
    assert.equal(
      await fs.readFile(path.join(folder, ".git/fixture-marker"), "utf8"),
      "Preserved Git data",
    );
    assert.equal(
      await fs
        .stat(path.join(folder, "_bmad"))
        .then(() => true)
        .catch(() => false),
      false,
    );
    console.log("PASS reviewed uninstall preserves source and Git");
    assert.deepEqual(errors, []);
    await fs.writeFile(
      path.join(screenshots, "report.json"),
      JSON.stringify({ base, checks, errors }, null, 2),
    );
    console.log("Screenshots: " + screenshots);
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (projectId) await prisma.repo.deleteMany({ where: { id: projectId } });
    if (connectionId)
      await prisma.bmadConnection.deleteMany({ where: { id: connectionId } });
    const resolved = path.resolve(folder);
    assert.ok(
      resolved.startsWith(
        path.resolve(workspace) + path.sep + ".bmad-manager-qa-",
      ),
    );
    await fs.rm(resolved, { recursive: true, force: true });
    await prisma.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
