import { describe, it, expect, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: vi.fn(),
    });
    queueMicrotask(() => child.emit("close", 1));
    return child;
  }),
}));
vi.mock("../db/client", () => ({ prisma: {} }));
import { writeAgentOverride } from "../../../scripts/bmad-worker";
describe("worker customization rollback", () => {
  it("restores descriptor, behavior and personal ignore rules after resolver rejection", async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "bmad-customization-test-"),
    );
    try {
      await fs.mkdir(path.join(root, "_bmad/custom"), { recursive: true });
      await fs.mkdir(path.join(root, "_bmad/scripts"), { recursive: true });
      await fs.mkdir(path.join(root, ".agents/skills/bmad-agent-dev"), {
        recursive: true,
      });
      const originals = new Map([
        ["_bmad/custom/config.user.toml", '[agents.dev]\nname="Original"\n'],
        [
          "_bmad/custom/bmad-agent-dev.user.toml",
          '[agent]\nidentity="Original behavior"\n',
        ],
        [".gitignore", "node_modules/\n"],
        [
          ".agents/skills/bmad-agent-dev/customize.toml",
          '[agent]\nidentity="Vendor"\n',
        ],
        ["_bmad/scripts/resolve_customization.py", "# Installed resolver\n"],
      ]);
      for (const [file, text] of originals)
        await fs.writeFile(path.join(root, file), text);
      await expect(
        writeAgentOverride(root, {
          slug: "dev",
          skillName: "bmad-agent-dev",
          scope: "personal",
          name: "Changed",
          title: "Developer",
          icon: "D",
          description: "Test",
          persona: "Changed behavior",
        }),
      ).rejects.toThrow("resolver rejected");
      for (const [file, text] of originals)
        expect(await fs.readFile(path.join(root, file), "utf8")).toBe(text);
    } finally {
      expect(path.basename(root)).toMatch(/^bmad-customization-test-/);
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
