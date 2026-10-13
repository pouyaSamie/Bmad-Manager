import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Only initialize the dedicated container profile. Never import host credentials.
if (process.env.CLI_BRIDGE_PROVIDER === "agy") {
  const folder = path.join(os.homedir(), ".gemini", "antigravity-cli");
  const file = path.join(folder, "settings.json");
  await fs.mkdir(folder, { recursive: true, mode: 0o700 });
  let settings;
  try {
    settings = JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT")
      throw new Error("Invalid container AGY settings");
    settings = {};
  }
  const required = [
    "read_file(*)",
    "write_file(*)",
    "command(*)",
    "unsandboxed(*)",
    "mcp(*)",
    "read_url(*)",
    "execute_url(*)",
  ];
  settings.permissions ??= {};
  const deny = settings.permissions.deny ?? [];
  if (!Array.isArray(deny)) throw new Error("Invalid container AGY deny rules");
  settings.permissions.deny = [...new Set([...deny, ...required])];
  const temporary = file + `.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(settings, null, 2) + "\n", {
    mode: 0o600,
  });
  await fs.rename(temporary, file);
}
