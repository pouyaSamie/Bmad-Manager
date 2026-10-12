import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PORT = parseInt(process.env.AGY_GATEWAY_PORT || "3005", 10);
const HOST = process.env.AGY_GATEWAY_HOST || "0.0.0.0";

function resolveAgyBin(): string {
  if (process.env.AGY_BIN && fs.existsSync(process.env.AGY_BIN)) {
    return process.env.AGY_BIN;
  }
  const localAppData = process.env.LOCALAPPDATA || "";
  const standardPath = path.join(localAppData, "agy", "bin", "agy.exe");
  if (fs.existsSync(standardPath)) {
    return standardPath;
  }
  return "agy";
}

const AGY_BIN = resolveAgyBin();

const AVAILABLE_MODELS = [
  { id: "gemini-3.8-flash-high", name: "Gemini 3.8 Flash (High Reasoning)", context: 1048576 },
  { id: "gemini-3.8-flash-medium", name: "Gemini 3.8 Flash (Medium Reasoning)", context: 1048576 },
  { id: "gemini-3.8-flash-low", name: "Gemini 3.8 Flash (Low / Ultra-Fast)", context: 1048576 },
  { id: "gemini-3.7-flash-high", name: "Gemini 3.7 Flash (High Reasoning)", context: 1048576 },
  { id: "gemini-3.1-pro-high", name: "Gemini 3.1 Pro (High Reasoning)", context: 2097152 },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6 (Thinking via AGY)", context: 200000 },
  { id: "claude-opus-4-6-thinking", name: "Claude Opus 4.6 (Thinking via AGY)", context: 200000 },
];

function setCorsHeaders(res: http.ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
}

function buildPrompt(messages: Array<{ role: string; content: string }>): string {
  const systemMessages = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const conversation = messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      const role = m.role === "assistant" ? "Assistant" : "User";
      return `${role}:\n${m.content}`;
    })
    .join("\n\n");

  let prompt = "";
  if (systemMessages) {
    prompt += `[System Instructions]\n${systemMessages}\n\n`;
  }
  if (conversation) {
    prompt += `[Conversation]\n${conversation}\n\nAssistant:\n`;
  } else {
    prompt += systemMessages;
  }
  return prompt;
}

const server = http.createServer((req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  // Health check
  if (url.pathname === "/health" || url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        service: "Antigravity (AGY) Gateway Bridge",
        subscription: "Active Logged-in Google Antigravity Subscription",
        binaryPath: AGY_BIN,
        defaultModel: "gemini-3.8-flash-high",
        availableModels: AVAILABLE_MODELS.map((m) => m.id),
      })
    );
    return;
  }

  // OpenAI-compatible /v1/models
  if (url.pathname === "/v1/models" || url.pathname === "/models") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        object: "list",
        data: AVAILABLE_MODELS.map((m) => ({
          id: m.id,
          object: "model",
          created: Math.floor(Date.now() / 1000),
          owned_by: "google-antigravity",
          permission: [],
          root: m.id,
          parent: null,
        })),
      })
    );
    return;
  }

  // OpenAI-compatible /v1/chat/completions
  if (
    req.method === "POST" &&
    (url.pathname === "/v1/chat/completions" || url.pathname === "/chat/completions")
  ) {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const model = payload.model || "gemini-3.8-flash-high";
        const messages = Array.isArray(payload.messages) ? payload.messages : [];
        const isStreaming = payload.stream !== false;
        const prompt = buildPrompt(messages);

        if (!prompt.trim()) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { message: "No prompt content provided" } }));
          return;
        }

        const args = [
          "--model",
          model,
          "--disable-slash-commands",
          "--dangerously-skip-permissions",
          "--output-format",
          "stream-json",
          "-p",
          prompt,
        ];

        console.log(`[AGY Gateway] Spawning agy with model: ${model}`);
        const child = spawn(AGY_BIN, args, {
          shell: false,
          windowsHide: true,
        });

        const reqId = `chatcmpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        let accumulatedText = "";
        let lineBuffer = "";

        if (isStreaming) {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });
        }

        req.on("close", () => {
          if (!child.killed) {
            console.log(`[AGY Gateway] Client disconnected, killing agy child process`);
            child.kill();
          }
        });

        child.stdout.on("data", (data: Buffer) => {
          lineBuffer += data.toString("utf8");
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("{")) continue;

            try {
              const event = JSON.parse(trimmed);
              if (
                event.event === "step_update" &&
                event.step_update &&
                typeof event.step_update.text_delta === "string"
              ) {
                const delta = event.step_update.text_delta;
                accumulatedText += delta;

                if (isStreaming && delta) {
                  const chunk = {
                    id: reqId,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model,
                    choices: [
                      {
                        index: 0,
                        delta: { content: delta },
                        finish_reason: null,
                      },
                    ],
                  };
                  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                }
              }
            } catch {
              // Ignore partial or unparsable JSON lines
            }
          }
        });

        child.stderr.on("data", (errData: Buffer) => {
          console.error(`[AGY CLI stderr]: ${errData.toString("utf8")}`);
        });

        child.on("close", (code) => {
          console.log(`[AGY Gateway] agy finished with exit code ${code}`);

          if (isStreaming) {
            const finalChunk = {
              id: reqId,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [
                {
                  index: 0,
                  delta: {},
                  finish_reason: "stop",
                },
              ],
            };
            res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
            res.write("data: [DONE]\n\n");
            res.end();
          } else {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                id: reqId,
                object: "chat.completion",
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [
                  {
                    index: 0,
                    message: {
                      role: "assistant",
                      content: accumulatedText || "No response received.",
                    },
                    finish_reason: "stop",
                  },
                ],
              })
            );
          }
        });

        child.on("error", (err) => {
          console.error("[AGY Gateway] Child process error:", err);
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: {
                  message: `Failed to execute Antigravity CLI: ${err.message}`,
                },
              })
            );
          } else {
            res.end();
          }
        });
      } catch (err) {
        console.error("[AGY Gateway] Error parsing request:", err);
        if (!res.headersSent) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { message: "Invalid JSON request payload" } }));
        }
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: { message: "Not found" } }));
});

server.listen(PORT, HOST, () => {
  console.log(`=======================================================`);
  console.log(`⚡ Antigravity (AGY) Gateway Bridge running at:`);
  console.log(`   Host Local: http://localhost:${PORT}/v1`);
  console.log(`   Docker:     http://host.docker.internal:${PORT}/v1`);
  console.log(`   Binary:     ${AGY_BIN}`);
  console.log(`   Default:    gemini-3.8-flash-high`);
  console.log(`   Auth:       Using Active Logged-in AGY Subscription`);
  console.log(`=======================================================`);
});
