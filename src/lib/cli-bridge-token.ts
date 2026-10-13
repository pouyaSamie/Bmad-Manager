import { readFileSync } from "node:fs";

export function loadBridgeToken(
  env: Record<string, string | undefined> = process.env,
): string {
  let token = env.CLI_BRIDGE_TOKEN;
  if (env.CLI_BRIDGE_TOKEN_FILE) {
    try {
      token = readFileSync(env.CLI_BRIDGE_TOKEN_FILE, "utf8").trim();
    } catch {
      throw new Error(
        "Bridge token file cannot be read. Check the mounted secret.",
      );
    }
  }
  if (!token || token.length < 32 || /\s/.test(token)) {
    throw new Error("Set a random CLI bridge token of at least 32 characters.");
  }
  return token;
}
