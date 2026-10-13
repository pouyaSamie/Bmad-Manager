import { it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { parse } from "smol-toml";
import { planAgentFiles, assertFileSnapshot } from "../operation-files";
import { customizationState, previewBehavior } from "../agent-behavior";
import { detectInstallation } from "../bmad-installation";
const fixture = (version: string) =>
  fs
    .readFile(
      path.join(
        import.meta.dirname,
        "fixtures",
        "bmad-" + version,
        "dev-customize.toml",
      ),
      "utf8",
    )
    .then((s) => s.replace(/^\uFEFF/, ""));
for (const version of ["v6", "v7"])
  it(
    "preserves sparse overrides against real " + version + " schema",
    async () => {
      const schema = await fixture(version);
      const state = customizationState(
        schema,
        '[agent]\nidentity="Team"',
        '[agent]\ncommunication_style="Personal"',
      );
      expect(state.supported).toContain("principles");
      expect(state.origins.identity).toBe("team");
      expect(state.origins.communication_style).toBe("personal");
      const preview = previewBehavior(state, "team", { identity: "Edited" });
      expect(preview.identity).toBe("Edited");
      expect(preview.principles).toEqual(state.base.principles);
      const root = await fs.mkdtemp(path.join(os.tmpdir(), "bmad-plan-test-"));
      try {
        await fs.mkdir(path.join(root, ".cursor/skills/bmad-agent-dev"), {
          recursive: true,
        });
        await fs.writeFile(
          path.join(root, ".cursor/skills/bmad-agent-dev/customize.toml"),
          schema,
        );
        const changes = await planAgentFiles(root, {
          slug: "dev",
          skillName: "bmad-agent-dev",
          scope: "team",
          descriptor: {},
          behaviorPatch: { identity: "Edited" },
        });
        const behavior = changes.find((c) =>
          c.path.endsWith("bmad-agent-dev.toml"),
        )!;
        expect(parse(behavior.after!).agent).toEqual({ identity: "Edited" });
        await assertFileSnapshot(root, changes);
        await fs.mkdir(path.join(root, "_bmad/custom"), { recursive: true });
        await fs.writeFile(
          path.join(root, behavior.path),
          '[agent]\nidentity="Changed outside Manager"',
        );
        await expect(assertFileSnapshot(root, changes)).rejects.toThrow(
          "Files changed",
        );
      } finally {
        expect(path.basename(root)).toMatch(/^bmad-plan-test-/);
        await fs.rm(root, { recursive: true, force: true });
      }
    },
  );
it("detects stable legacy and preview setup without guessing a version", () => {
  expect(
    detectInstallation(
      {
        "_bmad/_config/manifest.yaml":
          "installation:\n  version: 6.12.0\nides: [codex]\nmodules: [core, bmm]",
      },
      [".agents/skills"],
    ),
  ).toMatchObject({ generation: "v6", canUpdate: true, modules: ["bmm"] });
  expect(
    detectInstallation({ "_bmad/config.toml": '[core]\nversion="7.0.0"' }, [
      ".cursor/skills",
    ]),
  ).toMatchObject({ generation: "v7", canUpdate: false });
  expect(
    detectInstallation(
      { "_bmad/config.toml": '[core]\nuser_name="Developer"' },
      [".agents/skills"],
    ).generation,
  ).toBe("unknown");
});

it("reset removes only the selected override and keeps unrelated behavior", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bmad-plan-test-"));
  try {
    await fs.mkdir(path.join(root, "_bmad/custom"), { recursive: true });
    await fs.writeFile(
      path.join(root, "_bmad/custom/dev.toml"),
      '[agent]\nidentity="Team"\nprinciples=["Keep"]',
    );
    const changes = await planAgentFiles(root, {
      slug: "dev",
      skillName: "dev",
      scope: "team",
      descriptor: {},
      behaviorReset: ["identity"],
    });
    expect(
      parse(changes.find((c) => c.path.endsWith("custom/dev.toml"))!.after!)
        .agent,
    ).toEqual({ principles: ["Keep"] });
  } finally {
    expect(path.basename(root)).toMatch(/^bmad-plan-test-/);
    await fs.rm(root, { recursive: true, force: true });
  }
});

it("detects v7 setup from real module records even when module versions start with six", async () => {
  const record = await fs.readFile(
    path.join(import.meta.dirname, "fixtures/bmad-v7/method-bmod.toml"),
    "utf8",
  );
  expect(
    detectInstallation({ ".cursor/skills/bmod-method/bmod.toml": record }, [
      ".cursor/skills",
    ]),
  ).toMatchObject({
    generation: "v7",
    method: "skills-or-plugin",
    canUpdate: false,
    moduleVersions: { method: "6.13.0-next" },
  });
});

it("passes real nested menu tables as plain objects to the client", async () => {
  const state = customizationState(await fixture("v6"), "", "");
  expect(Object.getPrototypeOf(state.effective.menu![0])).toBe(
    Object.prototype,
  );
});
it("preserves legacy Manager binding beneath supported per-skill overrides", () => {
  const state = customizationState(
    '[agent]\nidentity="Native"',
    '[agent]\nidentity="Team"',
    "",
    "Legacy",
  );
  expect(state.legacy?.identity).toBe("Legacy");
  expect(state.effective.identity).toBe("Team");
  expect(previewBehavior(state, "team", {}, ["identity"]).identity).toBe(
    "Legacy",
  );
});
