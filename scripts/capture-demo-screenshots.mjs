/**
 * Capture authenticated screenshots from the seeded local Docker demo.
 * Run after `docker compose -f docker-compose.demo.yml up -d`.
 */
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const appUrl = process.env.DEMO_URL ?? "http://localhost:3003";
const debugPort = 9223;
const profileDir = path.join(os.tmpdir(), `bmad-manager-capture-${Date.now()}`);
const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outputDir = path.resolve("docs");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function waitForDebugEndpoint() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return await getJson(`http://127.0.0.1:${debugPort}/json/version`);
    } catch {
      await delay(250);
    }
  }
  throw new Error("Chrome did not expose a debugging endpoint.");
}

function connectCdp(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    let messageId = 0;

    socket.addEventListener("open", () => {
      resolve({
        send(method, params = {}) {
          return new Promise((resolveMessage, rejectMessage) => {
            const id = ++messageId;
            pending.set(id, { resolve: resolveMessage, reject: rejectMessage });
            socket.send(JSON.stringify({ id, method, params }));
          });
        },
        close() {
          socket.close();
        },
      });
    });
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    });
    socket.addEventListener("error", reject);
  });
}

async function openPage() {
  const page = await getJson(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(`${appUrl}/login`)}`, { method: "PUT" });
  return connectCdp(page.webSocketDebuggerUrl);
}

async function navigate(cdp, pathname) {
  await cdp.send("Page.navigate", { url: `${appUrl}${pathname}` });
  await delay(900);
}

async function screenshot(cdp, fileName) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  await writeFile(path.join(outputDir, fileName), Buffer.from(data, "base64"));
}

async function main() {
  await mkdir(profileDir, { recursive: true });
  const chromeProcess = spawn(chrome, [
    "--headless=new",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ], { stdio: "ignore" });

  try {
    await waitForDebugEndpoint();
    const cdp = await openPage();
    await cdp.send("Page.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1920,
      height: 1200,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await navigate(cdp, "/login");

    const signIn = await cdp.send("Runtime.evaluate", {
      awaitPromise: true,
      returnByValue: true,
      expression: `fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'demo@bmadmanager.local', password: 'demo-password-2026' })
      }).then(async (response) => ({ status: response.status, body: await response.text() }))`,
    });
    if (signIn.result.value?.status !== 200) {
      throw new Error(`Demo sign-in failed: ${JSON.stringify(signIn.result.value)}`);
    }

    const pages = [
      ["/", "screen1.png"],
      ["/repo/local/atlas-platform", "screen2.png"],
      ["/repo/local/atlas-platform/epics", "screen3.png"],
      ["/repo/local/atlas-platform/stories?view=board&epic=all", "screen4.png"],
      ["/repo/local/atlas-platform/docs", "screen5.png"],
      ["/repo/local/atlas-platform/control", "screen6.png"],
    ];
    for (const [pathname, fileName] of pages) {
      await navigate(cdp, pathname);
      await screenshot(cdp, fileName);
    }
    cdp.close();
    console.log(`Captured ${pages.length} demo screenshots in ${outputDir}.`);
  } finally {
    chromeProcess.kill();
    // Chrome may release its profile lock shortly after receiving the kill
    // signal. Cleanup is best-effort and must not hide a capture error.
    await delay(500);
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
