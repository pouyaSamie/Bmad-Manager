import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { decryptSecret, discoverBmad, encryptSecret, safeChild, validCustomPath, validSkillSlug } from "../bmad-control";

let tempDir: string;

beforeEach(async () => {
  process.env.AGENT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64url");
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bmad-control-"));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
  delete process.env.AGENT_ENCRYPTION_KEY;
});

describe("BMad Control safeguards", () => {
  it("encrypts gateway credentials without retaining plaintext", () => {
    const encrypted = encryptSecret("gateway-secret");
    expect(encrypted).not.toContain("gateway-secret");
    expect(decryptSecret(encrypted)).toBe("gateway-secret");
  });

  it("keeps managed writes within the project root", () => {
    expect(safeChild(tempDir, "_bmad/custom/bmad-agent-dev.toml")).toContain(tempDir);
    expect(() => safeChild(tempDir, "../outside.toml")).toThrow("escapes");
    expect(validCustomPath("_bmad/custom/bmad-agent-dev.toml")).toBe(true);
    expect(validCustomPath("_bmad/config.toml")).toBe(false);
    expect(validSkillSlug("security-reviewer")).toBe(true);
    expect(validSkillSlug("../unsafe")).toBe(false);
  });

  it("discovers installed BMad agents and skills", async () => {
    await fs.mkdir(path.join(tempDir, "_bmad"), { recursive: true });
    await fs.mkdir(path.join(tempDir, ".agents", "skills", "bmad-agent-dev"), { recursive: true });
    await fs.writeFile(path.join(tempDir, "_bmad", "config.toml"), '[agents.bmad-agent-dev]\nname = "Amelia"\ntitle = "Developer"\nicon = "💻"\n');
    await fs.mkdir(path.join(tempDir, "_bmad", "custom"), { recursive: true });
    await fs.writeFile(path.join(tempDir, "_bmad", "custom", "config.toml"), '[agents.bmad-agent-dev]\ndescription = "Custom persona"\npersona = "Always review tests"\nskill = "bmad-agent-dev"\n');
    await fs.writeFile(path.join(tempDir, ".agents", "skills", "bmad-agent-dev", "SKILL.md"), '---\nname: bmad-agent-dev\ndescription: Build software\n---\n');
    const result = await discoverBmad(tempDir);
    expect(result.agents).toMatchObject([{ slug: "bmad-agent-dev", name: "Amelia", description: "Custom persona", persona: "Always review tests", skillName: "bmad-agent-dev" }]);
    expect(result.skills).toMatchObject([{ name: "bmad-agent-dev", description: "Build software" }]);
  });
});