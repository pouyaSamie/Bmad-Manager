import {
  planAgentFiles,
  assertFileSnapshot,
  workflowText,
  type FileChange,
} from "../src/lib/operation-files";
import "dotenv/config";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "../src/lib/toml";
import { stringify } from "smol-toml";
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
  const changes = await planAgentFiles(root, payload);
  const skill = String(payload.skillName),
    resolver = safeChild(root, "_bmad/scripts/resolve_customization.py");
  const locations = [
    ".agents/skills",
    ".agent/skills",
    ".claude/skills",
    ".cursor/skills",
    ".cline/skills",
    ".bob/skills",
    ".adal/skills",
  ];
  let skillDirectory: string | undefined;
  for (const location of locations) {
    const dir = safeChild(root, location + "/" + skill);
    if (
      await fs
        .stat(dir)
        .then((s) => s.isDirectory())
        .catch(() => false)
    ) {
      skillDirectory = dir;
      break;
    }
  }
  try {
    for (const change of changes) {
      const target = safeChild(root, change.path);
      if (change.after === null) await fs.unlink(target).catch(() => {});
      else await atomicWrite(target, change.after);
    }
    if (
      skillDirectory &&
      (await fs
        .stat(resolver)
        .then(() => true)
        .catch(() => false))
    )
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
        child.on("error", (e) => {
          clearTimeout(timer);
          reject(e);
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          if (code === 0) resolve();
          else reject(new Error("Customization resolver rejected override"));
        });
      });
  } catch (error) {
    for (const change of changes) {
      const target = safeChild(root, change.path);
      if (change.before === null) await fs.unlink(target).catch(() => {});
      else await atomicWrite(target, change.before);
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
  const snapshot = (operation.preview as { fileChanges?: FileChange[] } | null)
    ?.fileChanges;
  if (snapshot) await assertFileSnapshot(root, snapshot);
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
    const { found } = await syncProjectBmadRuntime(
      operation.runtime.repoId,
      root,
    );
    if (operation.kind === "update" && !found.profile.canUpdate)
      throw new Error(found.profile.reason);
    if (found.profile.generation === "v7")
      throw new Error("Use native bmad setup for this installation");
    if (operation.kind === "install" && found.profile.generation !== "missing")
      throw new Error(
        "BMad appeared after import. Inspect and create an update draft instead.",
      );
    return runBmadInstaller(root, {
      action: operation.kind === "update" ? "update" : "install",
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
      channel:
        operation.kind === "update"
          ? undefined
          : payload.channel === "next"
            ? "next"
            : "stable",
      shims: operation.kind === "update" ? undefined : Boolean(payload.shims),
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
      workflowText(graph),
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
        .stat(skillDir)
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
  const held = await prisma.bmadWorkerLease.findMany({
    select: { operationId: true },
  });
  const locked = await prisma.bmadOperation.findMany({
    where: { id: { in: held.map((l) => l.operationId) } },
    select: { runtimeId: true },
  });
  return prisma.bmadOperation.findFirst({
    where: {
      status: "queued",
      runtimeId: { notIn: locked.map((o) => o.runtimeId) },
      ...(process.argv.includes("--operation-id")
        ? { id: process.argv[process.argv.indexOf("--operation-id") + 1] }
        : {}),
    },
    orderBy: { approvedAt: "asc" },
    include: { runtime: { include: { repo: true } } },
  });
}

const workerId = crypto.randomUUID();
export async function recoverExpiredOperations() {
  const stale = await prisma.bmadWorkerLease.findMany({
    where: {
      expiresAt: { lt: new Date() },
      ...(process.argv.includes("--operation-id")
        ? {
            operationId:
              process.argv[process.argv.indexOf("--operation-id") + 1],
          }
        : {}),
    },
  });
  for (const lease of stale)
    await prisma.$transaction(async (tx) => {
      const stillExpired = await tx.bmadWorkerLease.updateMany({
        where: { runtimeId: lease.runtimeId, expiresAt: { lt: new Date() } },
        data: { heartbeatAt: lease.heartbeatAt },
      });
      if (stillExpired.count)
        await tx.bmadOperation.updateMany({
          where: { id: lease.operationId, status: "running" },
          data: {
            status: "failed",
            completedAt: new Date(),
            error:
              "Worker heartbeat expired. Stop the previous worker and any installer child process, then inspect partial files before releasing the project lock. Automatic retry is disabled.",
          },
        });
    });
}

let prerequisiteCache: Record<string, string> | undefined;
async function prerequisites() {
  if (prerequisiteCache) return prerequisiteCache;
  const check = async (bin: string) =>
    new Promise<string>((resolve) => {
      const child = spawn(bin, ["--version"], {
        shell: false,
        windowsHide: true,
        stdio: "pipe",
      });
      let out = "";
      const timer = setTimeout(() => {
        child.kill();
        resolve("unavailable");
      }, 3000);
      child.stdout.on("data", (c) => (out += c));
      child.stderr.resume();
      child.on("error", () => {
        clearTimeout(timer);
        resolve("unavailable");
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve(
          code === 0
            ? (out.match(/\d+\.\d+(?:\.\d+)?/)?.[0] ?? "available")
            : "unavailable",
        );
      });
    });
  prerequisiteCache = {
    node: process.version,
    uv: await check("uv"),
    git: await check("git"),
  };
  return prerequisiteCache;
}
async function presence() {
  await prisma.bmadWorkerPresence.upsert({
    where: { id: workerId },
    create: {
      id: workerId,
      heartbeatAt: new Date(),
      capabilities: await prerequisites(),
    },
    update: { heartbeatAt: new Date() },
  });
}
export async function run() {
  await presence();
  await recoverExpiredOperations();
  const operation = await nextOperation();
  if (!operation) return false;
  const physicalRoot = await fs
    .realpath(
      path.dirname(safeChild(operation.runtime.repo.localPath!, ".bmad-lock")),
    )
    .catch(() => operation.runtime.repo.localPath!);
  const lockKey = crypto
    .createHash("sha256")
    .update(
      process.platform === "win32" ? physicalRoot.toLowerCase() : physicalRoot,
    )
    .digest("hex");
  const now = new Date();
  const claimed = await prisma.$transaction(async (tx) => {
    const lease = await tx.bmadWorkerLease.createMany({
      data: {
        runtimeId: lockKey,
        operationId: operation.id,
        workerId,
        heartbeatAt: now,
        expiresAt: new Date(now.getTime() + 60000),
      },
      skipDuplicates: true,
    });
    if (!lease.count) return false;
    const result = await tx.bmadOperation.updateMany({
      where: { id: operation.id, status: "queued" },
      data: { status: "running", startedAt: now },
    });
    if (!result.count)
      await tx.bmadWorkerLease.deleteMany({
        where: { runtimeId: lockKey, workerId },
      });
    return !!result.count;
  });
  if (!claimed) return false;
  const heartbeat = setInterval(() => {
    void Promise.all([
      presence(),
      prisma.bmadWorkerLease.updateMany({
        where: { runtimeId: lockKey, workerId, expiresAt: { gt: new Date() } },
        data: {
          heartbeatAt: new Date(),
          expiresAt: new Date(Date.now() + 60000),
        },
      }),
    ]).catch(() =>
      console.error("Worker heartbeat failed; inspect worker database access."),
    );
  }, 10000);
  try {
    const output = await execute(operation);
    if (operation.kind !== "uninstall")
      await rescan(operation.runtime.id, operation.runtime.repo.localPath!);
    await prisma.bmadOperation.updateMany({
      where: { id: operation.id, status: "running" },
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
    await prisma.bmadOperation.updateMany({
      where: { id: operation.id, status: "running" },
      data: {
        status: "failed",
        error:
          error instanceof Error && error.message.startsWith("Files changed")
            ? "Files changed since review. Create and approve a fresh draft."
            : "Operation failed. Inspect worker diagnostics and partial project changes before creating a new draft.",
        completedAt: new Date(),
      },
    });
  } finally {
    clearInterval(heartbeat);
    await prisma.bmadWorkerLease.deleteMany({
      where: { runtimeId: lockKey, workerId },
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
  while (true) {
    try {
      await run();
    } catch (error) {
      console.error(redact(String(error)));
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
}

if (process.argv[1] && /bmad-worker\.(ts|js)$/.test(process.argv[1]))
  void main();
