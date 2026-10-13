import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadBridgeToken } from "../cli-bridge-token";

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0))
    fs.rmSync(folder, { recursive: true });
});
describe("bridge runtime secrets", () => {
  it("keeps existing host environment authentication compatible", () => {
    expect(loadBridgeToken({ CLI_BRIDGE_TOKEN: "a".repeat(43) })).toBe(
      "a".repeat(43),
    );
  });
  it("uses the mounted file instead of a stale environment token", () => {
    const folder = fs.mkdtempSync(
      path.join(os.tmpdir(), "bridge-secret-test-"),
    );
    folders.push(folder);
    const file = path.join(folder, "token");
    fs.writeFileSync(file, "b".repeat(43) + "\n");
    expect(
      loadBridgeToken({
        CLI_BRIDGE_TOKEN_FILE: file,
        CLI_BRIDGE_TOKEN: "a".repeat(43),
      }),
    ).toBe("b".repeat(43));
  });
  it("fails closed on an unreadable mounted secret without leaking its path", () => {
    expect(() =>
      loadBridgeToken({
        CLI_BRIDGE_TOKEN_FILE: "/private/missing/secret",
        CLI_BRIDGE_TOKEN: "a".repeat(43),
      }),
    ).toThrow("Bridge token file cannot be read. Check the mounted secret.");
  });
  it("rejects missing, short and whitespace-bearing tokens without exposing them", () => {
    for (const token of [undefined, "short", "sensitive ".repeat(5)]) {
      expect(() => loadBridgeToken({ CLI_BRIDGE_TOKEN: token })).toThrow(
        "Set a random CLI bridge token of at least 32 characters.",
      );
    }
  });
});
