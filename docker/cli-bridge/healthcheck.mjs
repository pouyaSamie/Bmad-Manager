import fs from "node:fs";
const token = fs.readFileSync(process.env.CLI_BRIDGE_TOKEN_FILE, "utf8").trim();
const port = process.env.CLI_BRIDGE_PROVIDER === "agy" ? 3005 : 3006;
try {
  const response = await fetch(`http://127.0.0.1:${port}/healthz`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(3000),
  });
  process.exit(response.ok ? 0 : 1);
} catch {
  process.exit(1);
}
