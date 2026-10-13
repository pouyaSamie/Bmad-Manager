import "dotenv/config";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

import fs from "node:fs/promises";
import path from "node:path";
import { parse, stringify } from "smol-toml";
import { validateGraph } from "../src/lib/workflow-graph";
import { syncProjectBmadRuntime } from "../src/lib/bmad-control";
import { prisma } from "../src/lib/db/client";
import {
  redact,
  runBmadInstaller,
  safeChild,
  validCustomPath,
  validSkillSlug,
} from "../src/lib/bmad-control";

async function atomicWrite(target: string, content: string) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = target + "." + crypto.randomUUID() + ".tmp";
  await fs.writeFile(tmp, content);
  await fs.rename(tmp, target);
}
export async function writeAgentOverride(
  root: string,
  payload: Record<string, unknown>,
) {
  const slug = String(payload.slug ?? ""),
    skill = String(payload.skillName ?? "");
  if (!validSkillSlug(slug) || !validSkillSlug(skill))
    throw new Error("Invalid customization");
  const suffix = payload.scope === "personal" ? ".user" : "";
  const target = safeChild(root, "_bmad/custom/config" + suffix + ".toml");
  const current = await fs.readFile(target, "utf8").catch(() => "");
  const doc = current.trim() ? parse(current) : {};
  const agents = (doc.agents ?? {}) as Record<
    string,
    import("smol-toml").TomlValue
  >;
  doc.agents = agents;
  agents[slug] = {
    ...((agents[slug] as object) ?? {}),
    name: String(payload.name),
    title: String(payload.title),
    icon: String(payload.icon),
    description: String(payload.description),
    skill,
  };
  const behavior = safeChild(root, "_bmad/custom/" + skill + suffix + ".toml");
  const previous = await fs.readFile(behavior, "utf8").catch(() => "");
  const override = previous.trim() ? parse(previous) : {};
  override.agent = {
    ...((override.agent as object) ?? {}),
    identity: String(payload.persona ?? ""),
  };
  const locations = [
    ".agents/skills",
    ".agent/skills",
    ".claude/skills",
    ".cline/skills",
    ".bob/skills",
    ".adal/skills",
  ];
  let skillDirectory: string | undefined;
  for (const location of locations) {
    const dir = safeChild(root, location + "/" + skill);
    const schema = await fs
      .readFile(
        safeChild(root, location + "/" + skill + "/customize.toml"),
        "utf8",
      )
      .catch(() => null);
    if (schema) {
      const native = parse(schema).agent as Record<string, unknown> | undefined;
      if (native && !("identity" in native))
        throw new Error("This skill does not expose identity customization");
      skillDirectory = dir;
      break;
    }
  }
  const ignore = safeChild(root, ".gitignore");
  const priorIgnore = await fs.readFile(ignore, "utf8").catch(() => null);
  try {
    await atomicWrite(behavior, stringify(override));
    await atomicWrite(target, stringify(doc));
    if (payload.scope === "personal") {
      const ignore = safeChild(root, ".gitignore");
      const text = await fs.readFile(ignore, "utf8").catch(() => "");
      if (!text.split(/\r?\n/).includes("*.user.toml"))
        await atomicWrite(ignore, text.trimEnd() + "\n*.user.toml\n");
    }
    const resolver = safeChild(root, "_bmad/scripts/resolve_customization.py");
    if (
      skillDirectory &&
      (await fs
        .stat(resolver)
        .then(() => true)
        .catch(() => false))
    ) {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          "uv",
          ["run", resolver, "--skill", skillDirectory!, "--project-root", root],
          { cwd: root, shell: false, windowsHide: true },
        );
        const timer = setTimeout(() => {
          child.kill();
          reject(new Error("Customization resolver timed out"));
        }, 30000);
        child.stdout.resume();
        child.stderr.resume();
        child.on("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          if (code === 0) resolve();
          else reject(new Error("Customization resolver rejected override"));
        });
      });
    }
  } catch (error) {
    for (const [file, original] of [
      [behavior, previous || null],
      [target, current || null],
      [ignore, priorIgnore],
    ] as const) {
      if (original === null) await fs.unlink(file).catch(() => {});
      else await atomicWrite(file, original);
    }
    throw error;
  }
  return "Updated agent descriptor and per-skill behavior override";
}
export async function execute(
  operation: Awaited<ReturnType<typeof nextOperation>>,
) {
  if (!operation) return false;
  const root = operation.runtime.repo.localPath;
  if (!root) throw new Error("Operation project is not a local folder");
  const payload = operation.payload as Record<string, unknown>;
  if (operation.kind === "uninstall") {
    for (const relative of ["_bmad", "_bmad-output", ".agents/skills"]) {
      const target = safeChild(root, relative);
      await fs.rm(target, { recursive: true, force: true });
    }
    return "BMad assets removed; source code and Git preserved";
  }
  if (operation.kind === "install" || operation.kind === "update") {
    const tools = Array.isArray(payload.tools)
      ? payload.tools.map(String)
      : ["codex"];
    const modules = Array.isArray(payload.modules)
      ? payload.modules.map(String)
      : ["bmm"];
    return runBmadInstaller(root, {
      tools,
      modules,
      userName:
        typeof payload.userName === "string" ? payload.userName : undefined,
      communicationLanguage:
        typeof payload.communicationLanguage === "string"
          ? payload.communicationLanguage
          : undefined,
      documentOutputLanguage:
        typeof payload.documentOutputLanguage === "string"
          ? payload.documentOutputLanguage
          : undefined,
      outputFolder:
        typeof payload.outputFolder === "string"
          ? payload.outputFolder
          : undefined,
      channel: payload.channel === "next" ? "next" : "stable",
      shims: Boolean(payload.shims),
    });
  }
  if (operation.kind === "set_workflow") {
    const graph = validateGraph(payload.graph);
    const agents = await prisma.bmadAgent.findMany({
      where: { runtimeId: operation.runtime.id, available: true },
    });
    if (graph.nodes.some((n) => !agents.some((a) => a.slug === n.agentSlug)))
      throw new Error("Unknown workflow agent");
    await atomicWrite(
      safeChild(root, "_bmad/custom/workflow.toml"),
      "# Bmad Manager design configuration. Does not execute BMad workflows.\n" +
        stringify({
          manager: { version: 2 },
          nodes: graph.nodes.map((n) => ({
            id: n.id,
            agent: n.agentSlug,
            x: n.position.x,
            y: n.position.y,
          })),
          edges: graph.edges,
        }),
    );
    await prisma.bmadProjectRuntime.update({
      where: { id: operation.runtime.id },
      data: { workflow: graph },
    });
    return "Applied workflow design";
  }
  if (operation.kind === "customize_agent") {
    return writeAgentOverride(root, payload);
  }
  if (operation.kind === "write_override") {
    const relative = String(payload.path ?? "");
    if (!validCustomPath(relative) || typeof payload.content !== "string")
      throw new Error("Invalid customization target");
    const target = safeChild(root, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    parse(payload.content);
    await atomicWrite(target, payload.content);
    return `Wrote ${relative}`;
  }
  if (
    operation.kind === "create_agent" ||
    operation.kind === "write_skill" ||
    operation.kind === "clone_skill"
  ) {
    const slug = String(payload.slug ?? "");
    if (!validSkillSlug(slug)) throw new Error("Invalid managed skill slug");
    const name = String(payload.name ?? slug);
    const title = String(payload.title ?? "Custom BMad Agent");
    const icon = String(payload.icon ?? "🤖");
    const description = String(payload.description ?? "Custom project agent");
    const persona = String(payload.persona ?? description);
    const skillDir = safeChild(root, `.agents/skills/${slug}`);
    if (
      await fs
        .stat(safeChild(root, `.agents/skills/${slug}/SKILL.md`))
        .then(() => true)
        .catch(() => false)
    )
      throw new Error("Skill already exists; choose a new slug");
    if (operation.kind === "clone_skill") {
      const source = await prisma.bmadSkill.findFirst({
        where: {
          runtimeId: operation.runtime.id,
          directory: String(payload.sourceDirectory),
          source: { not: "missing" },
        },
      });
      if (!source) throw new Error("Clone source is unavailable");
      const sourcePath = safeChild(root, source.directory);
      await fs.cp(sourcePath, skillDir, {
        recursive: true,
        force: false,
        errorOnExist: true,
        filter: async (sourceFile) => {
          if ((await fs.lstat(sourceFile)).isSymbolicLink())
            throw new Error("Skill copies cannot include symbolic links");
          return true;
        },
      });
    } else await fs.mkdir(skillDir, { recursive: true });
    const skill =
      typeof payload.content === "string"
        ? payload.content
        : "---\nname: " +
          slug +
          "\ndescription: " +
          JSON.stringify(description) +
          "\n---\n\n# " +
          name +
          "\n\n## Persona\n" +
          persona;
    await fs.writeFile(
      safeChild(root, ".agents/skills/" + slug + "/SKILL.md"),
      skill + "\n\n<!-- Managed by Bmad-Manager. -->\n",
      { encoding: "utf8", flag: operation.kind === "clone_skill" ? "w" : "wx" },
    );
    if (
      operation.kind === "clone_skill" &&
      payload.assignAgent &&
      typeof payload.assignAgent === "object"
    )
      await writeAgentOverride(
        root,
        payload.assignAgent as Record<string, unknown>,
      );
    if (operation.kind === "create_agent") {
      await writeAgentOverride(root, {
        ...payload,
        slug,
        name,
        title,
        icon,
        description,
        persona,
        skillName:
          typeof payload.skillName === "string" ? payload.skillName : slug,
      });
      const target = safeChild(
        root,
        "_bmad/custom/config" +
          (payload.scope === "personal" ? ".user" : "") +
          ".toml",
      );
      const doc = parse(await fs.readFile(target, "utf8"));
      const agents = doc.agents as Record<string, Record<string, string>>;
      agents[slug].team = "custom";
      await atomicWrite(target, stringify(doc));
    }
    return `Created managed skill .agents/skills/${slug}/SKILL.md`;
  }
  throw new Error("Unsupported operation");
}

async function rescan(runtimeId: string, root: string) {
  const runtime = await prisma.bmadProjectRuntime.findUniqueOrThrow({
    where: { id: runtimeId },
  });
  await syncProjectBmadRuntime(runtime.repoId, root);
}
async function nextOperation() {
  return prisma.bmadOperation.findFirst({
    where: {
      status: "queued",
      ...(process.argv.includes("--operation-id")
        ? { id: process.argv[process.argv.indexOf("--operation-id") + 1] }
        : {}),
    },
    orderBy: { approvedAt: "asc" },
    include: { runtime: { include: { repo: true } } },
  });
}

async function run() {
  const operation = await nextOperation();
  if (!operation) return false;
  const claimed = await prisma.bmadOperation.updateMany({
    where: { id: operation.id, status: "queued" },
    data: { status: "running", startedAt: new Date() },
  });
  if (!claimed.count) return false;
  try {
    const output = await execute(operation);
    if (operation.kind !== "uninstall")
      await rescan(operation.runtime.id, operation.runtime.repo.localPath!);
    await prisma.bmadOperation.update({
      where: { id: operation.id },
      data: {
        status: "succeeded",
        output: redact(String(output)),
        completedAt: new Date(),
      },
    });
    if (operation.kind === "uninstall")
      await prisma.repo.delete({ where: { id: operation.runtime.repoId } });
  } catch (error) {
    console.error(redact(String(error)));
    await prisma.bmadOperation.update({
      where: { id: operation.id },
      data: {
        status: "failed",
        error: "Operation failed. Check worker diagnostics and project access.",
        completedAt: new Date(),
      },
    });
  }
  return true;
}

async function main() {
  if (process.argv.includes("--operation-id")) {
    await run();
    await prisma.$disconnect();
    return;
  }
  do {
    await new Promise((resolve) => setTimeout(resolve, 1500));
  } while (await run());
  setInterval(() => {
    void run();
  }, 3000);
}

if (process.argv[1] && /bmad-worker\.(ts|js)$/.test(process.argv[1]))
  void main();
