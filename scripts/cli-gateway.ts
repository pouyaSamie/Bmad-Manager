import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.bridge.local", quiet: true });
import http from "node:http";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { parse } from "smol-toml";
import { z } from "zod";
import { redact } from "../src/lib/output-redaction";
const provider = process.argv.includes("--agy") ? "agy" : "codex";
const token = process.env.CLI_BRIDGE_TOKEN;
if (!token || token.length < 32)
  throw new Error(
    "Set CLI_BRIDGE_TOKEN to a random token of at least 32 characters.",
  );
const port = Number(
  process.env[provider === "agy" ? "AGY_GATEWAY_PORT" : "CODEX_GATEWAY_PORT"] ??
    (provider === "agy" ? 3005 : 3006),
);
const host = process.env.CLI_BRIDGE_HOST ?? "127.0.0.1";
const bodySchema = z.object({
  model: z.string().min(1).max(200),
  stream: z.boolean().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().max(60000),
      }),
    )
    .max(40),
});
function authorized(req: http.IncomingMessage) {
  const supplied = Buffer.from(
    req.headers.authorization?.replace(/^Bearer /, "") ?? "",
  );
  const expected = Buffer.from(token!);
  return (
    supplied.length === expected.length &&
    crypto.timingSafeEqual(supplied, expected)
  );
}
async function binary(kind: "agy" | "codex") {
  if (kind === "agy")
    return {
      bin:
        process.env.AGY_BIN ??
        path.join(process.env.LOCALAPPDATA ?? "", "agy", "bin", "agy.exe"),
      args: [],
    };
  const configured = process.env.CODEX_BIN;
  if (
    configured &&
    !configured.endsWith(".cmd") &&
    !configured.endsWith(".ps1")
  )
    return { bin: configured, args: [] };
  const candidates = [
    path.join(
      process.env.APPDATA ?? "",
      "npm",
      "node_modules",
      "@openai",
      "codex",
      "bin",
      "codex.js",
    ),
    path.join(
      path.dirname(process.execPath),
      "node_modules",
      "@openai",
      "codex",
      "bin",
      "codex.js",
    ),
  ];
  for (const js of candidates) {
    if (
      await fs
        .access(js)
        .then(() => true)
        .catch(() => false)
    )
      return { bin: process.execPath, args: [js] };
  }
  throw new Error("Set CODEX_BIN to a native executable");
}
async function codex(workdir: string) {
  const b = await binary("codex");
  const configFile = path.join(
    process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"),
    "config.toml",
  );
  const text = await fs.readFile(configFile, "utf8").catch(() => "");
  const config = text.trim() ? parse(text) : {};
  const mcp = (config.mcp_servers ?? {}) as Record<string, unknown>;
  const overrides = [
    "features.shell_tool=false",
    "features.unified_exec=false",
    "features.apply_patch_freeform=false",
    'web_search="disabled"',
    "features.multi_agent=false",
    "features.apps=false",
    "features.plugins=false",
    ...Object.keys(mcp).map((key) => "mcp_servers." + key + ".enabled=false"),
  ].flatMap((v) => ["-c", v]);
  const child = spawn(b.bin, [...b.args, ...overrides, "app-server"], {
    cwd: workdir,
    windowsHide: true,
    shell: false,
    stdio: "pipe",
  });
  let counter = 0,
    buffer = "";
  const pending = new Map<
    number,
    {
      resolve: (v: Record<string, unknown>) => void;
      reject: (e: Error) => void;
    }
  >();
  let notify = (_event: {
    method: string;
    params: Record<string, unknown>;
  }) => {
    void _event;
  };
  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line);
        if (typeof e.id === "number" && pending.has(e.id)) {
          const p = pending.get(e.id)!;
          pending.delete(e.id);
          if (e.error) {
            console.warn(
              "Codex request rejected:",
              redact(String(e.error.message ?? "Unknown error")),
            );
            p.reject(new Error("Codex request failed"));
          } else p.resolve(e.result ?? {});
        } else if (e.id !== undefined) {
          child.stdin.write(
            JSON.stringify({
              id: e.id,
              error: {
                code: -32601,
                message:
                  "Tools and approvals are disabled in configuration test mode",
              },
            }) + "\n",
          );
        } else if (e.method) notify(e);
      } catch {}
    }
  });
  const fail = () => {
    for (const p of pending.values()) p.reject(new Error("Codex CLI stopped"));
    pending.clear();
  };
  child.on("error", fail);
  child.on("close", fail);
  child.stderr.on("data", () => {});
  function call(method: string, params: Record<string, unknown> = {}) {
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const id = ++counter;
      pending.set(id, { resolve, reject });
      child.stdin.write(JSON.stringify({ id, method, params }) + "\n");
    });
  }
  await call("initialize", {
    clientInfo: {
      name: "bmad_manager",
      title: "Bmad Manager",
      version: "1.0.0",
    },
  });
  child.stdin.write(
    JSON.stringify({ method: "initialized", params: {} }) + "\n",
  );
  return {
    child,
    call,
    onEvent: (fn: typeof notify) => {
      notify = fn;
    },
  };
}
export async function assertAgyRestricted() {
  const config = JSON.parse(
    await fs.readFile(
      path.join(os.homedir(), ".gemini", "antigravity-cli", "settings.json"),
      "utf8",
    ),
  );
  const deny = config.permissions?.deny ?? [];
  const required = [
    "read_file(*)",
    "write_file(*)",
    "command(*)",
    "unsandboxed(*)",
    "mcp(*)",
    "read_url(*)",
    "execute_url(*)",
  ];
  if (required.some((r) => !deny.includes(r)))
    throw new Error(
      "AGY test mode requires explicit deny rules for files, commands, MCP, and web tools.",
    );
}
function emit(res: http.ServerResponse, model: string, text: string) {
  res.write(
    "data: " +
      JSON.stringify({ model, choices: [{ delta: { content: text } }] }) +
      "\n\n",
  );
}
async function cliVersion(kind: "codex" | "agy") {
  const b = await binary(kind);
  return new Promise<string>((resolve) => {
    const child = spawn(b.bin, [...b.args, "--version"], {
      windowsHide: true,
      shell: false,
      stdio: "pipe",
    });
    let text = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve("unverified");
    }, 5000);
    child.stdout.on("data", (c) => (text += c));
    child.stderr.resume();
    child.on("error", () => {
      clearTimeout(timer);
      resolve("unavailable");
    });
    child.on("close", () => {
      clearTimeout(timer);
      resolve(text.match(/\d+\.\d+(?:\.\d+)?/)?.[0] ?? "unverified");
    });
  });
}
const server = http.createServer(async (req, res) => {
  if (!authorized(req)) {
    res.writeHead(401).end();
    return;
  }
  if (req.headers.origin) {
    res.writeHead(403).end();
    return;
  }
  let child: ChildProcessWithoutNullStreams | undefined;
  let workdir: string | undefined;
  const timer = setTimeout(() => {
    child?.kill();
    if (!res.writableEnded) res.end();
  }, 120000);
  res.on("close", () => child?.kill());
  try {
    workdir = await fs.mkdtemp(path.join(os.tmpdir(), "bmad-test-"));
    if (provider === "agy") await assertAgyRestricted();
    if (req.method === "GET" && req.url === "/v1/models") {
      let models: { id: string; name: string }[] = [];
      let authenticated = false;
      if (provider === "codex") {
        const rpc = await codex(workdir);
        child = rpc.child;
        const account = await rpc.call("account/read", { refreshToken: false });
        if (!account.account) throw new Error("Codex login required");
        authenticated = true;
        let cursor: unknown;
        do {
          const catalog = await rpc.call("model/list", {
            limit: 100,
            cursor,
            includeHidden: false,
          });
          models.push(
            ...(
              catalog.data as {
                id: string;
                displayName: string;
                model: string;
              }[]
            ).map((m) => ({
              id: m.model ?? m.id,
              name: m.displayName ?? m.id,
            })),
          );
          cursor = catalog.nextCursor;
        } while (cursor);
      } else {
        const b = await binary("agy");
        const out = await new Promise<string>((resolve, reject) => {
          child = spawn(b.bin, [...b.args, "models"], {
            cwd: workdir,
            windowsHide: true,
            stdio: "pipe",
            shell: false,
          });
          let text = "";
          child.stdout.on("data", (c) => (text += c));
          child.on("error", reject);
          child.on("close", (code) =>
            code === 0
              ? resolve(text)
              : reject(new Error("AGY catalog failed")),
          );
        });
        models = out
          .split(/\r?\n/)
          .map((l) => l.trim().match(/^([a-z0-9][a-z0-9._-]+)\s+(.+)$/i))
          .filter((m): m is RegExpMatchArray => !!m)
          .map((m) => ({ id: m[1], name: m[2] }));
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          data: models,
          restricted: true,
          authenticated,
          diagnostics: {
            provider,
            version: process.env.npm_package_version ?? "1",
            login: authenticated ? "verified" : "unverified",
            restricted: true,
            protocol: provider === "codex" ? "app-server" : "openai-compatible",
            cliVersion: await cliVersion(provider),
          },
        }),
      );
      return;
    }
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
      res.writeHead(404).end();
      return;
    }
    let raw = "";
    for await (const c of req) {
      raw += c;
      if (raw.length > 1024 * 1024) throw new Error("Request too large");
    }
    const body = bodySchema.parse(JSON.parse(raw));
    const prompt = body.messages
      .map((m) => m.role.toUpperCase() + ":\n" + m.content)
      .join("\n\n");
    if (provider === "codex") {
      const rpc = await codex(workdir);
      child = rpc.child;
      const thread = await rpc.call("thread/start", {
        model: body.model,
        cwd: workdir,
        sandbox: "read-only",
        approvalPolicy: "never",
        ephemeral: true,
        developerInstructions:
          "Configuration test chat only. All tools are disabled. Never execute commands, access files, use MCP, or modify anything.",
      });
      const threadId = (thread.thread as { id: string }).id;
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
      });
      await new Promise<void>(async (resolve, reject) => {
        rpc.onEvent((e) => {
          if (e.method === "item/agentMessage/delta")
            emit(res, body.model, String(e.params.delta ?? ""));
          if (e.method === "turn/completed") {
            const turn = e.params.turn as { status: string };
            if (turn.status === "completed") resolve();
            else {
              console.warn("Codex turn ended:", redact(JSON.stringify(turn)));
              reject(new Error("Codex turn failed"));
            }
          }
        });
        child!.once("close", () => reject(new Error("Codex process stopped")));
        try {
          await rpc.call("turn/start", {
            threadId,
            input: [{ type: "text", text: prompt }],
            model: body.model,
            approvalPolicy: "never",
            sandboxPolicy: {
              type: "readOnly",
              networkAccess: false,
            },
          });
        } catch (e) {
          reject(e);
        }
      });
    } else {
      const b = await binary("agy");
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
      });
      await new Promise<void>((resolve, reject) => {
        child = spawn(
          b.bin,
          [
            ...b.args,
            "--model",
            body.model,
            "--output-format",
            "stream-json",
            "-p",
            prompt,
          ],
          { cwd: workdir, windowsHide: true, stdio: "pipe", shell: false },
        );
        let buffer = "";
        child.stdout.on("data", (c) => {
          buffer += c;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            try {
              const event = JSON.parse(line);
              if (
                event.event === "step_update" &&
                event.step_update?.text_delta
              )
                emit(res, body.model, event.step_update.text_delta);
              if (
                event.event === "result" &&
                event.result?.status !== "SUCCESS"
              )
                reject(new Error("AGY turn failed"));
            } catch {}
          }
        });
        child.on("error", reject);
        child.on("close", (code) =>
          code === 0 ? resolve() : reject(new Error("AGY process failed")),
        );
        child.stderr.on("data", () => {});
      });
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch {
    if (!res.headersSent) {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: {
            message:
              "CLI bridge unavailable. Check login, binary configuration, and test-mode permissions.",
          },
        }),
      );
    } else {
      res.write(
        "data: " +
          JSON.stringify({
            error: { message: "CLI test failed or was cancelled" },
          }) +
          "\n\n",
      );
      res.end();
    }
  } finally {
    clearTimeout(timer);
    if (child && child.exitCode === null) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 5000);
        child!.once("close", () => {
          clearTimeout(timeout);
          resolve();
        });
        child!.kill();
      });
    }
    if (workdir) {
      const resolved = path.resolve(workdir);
      if (
        !resolved.startsWith(
          path.resolve(os.tmpdir()) + path.sep + "bmad-test-",
        )
      )
        throw new Error("Unexpected bridge cleanup path");
      await fs
        .rm(resolved, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 150,
        })
        .catch(() => console.warn("Temporary test workspace cleanup deferred"));
    }
  }
});
server.listen(port, host, () =>
  console.log(provider + " test bridge listening on " + host + ":" + port),
);
