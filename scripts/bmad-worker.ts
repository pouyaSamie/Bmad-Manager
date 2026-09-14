import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/db/client";
import { discoverBmad, redact, runBmadInstaller, safeChild, validCustomPath, validSkillSlug } from "../src/lib/bmad-control";

function tomlValue(value: unknown): string {
  return String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\r", "").replaceAll("\n", "\\n");
}

async function writeAgentOverride(root: string, payload: Record<string, unknown>) {
  const slug = String(payload.slug ?? "");
  if (!validSkillSlug(slug) || !validSkillSlug(String(payload.skillName ?? ""))) throw new Error("Invalid agent customization");
  const personal = payload.scope === "personal";
  const config = safeChild(root, `_bmad/custom/config${personal ? ".user" : ""}.toml`);
  const header = `[agents.${slug}]`;
  const section = `${header}\nname = "${tomlValue(payload.name)}"\ntitle = "${tomlValue(payload.title)}"\nicon = "${tomlValue(payload.icon)}"\ndescription = "${tomlValue(payload.description)}"\npersona = "${tomlValue(payload.persona)}"\nskill = "${tomlValue(payload.skillName)}"\n`;
  const current = await fs.readFile(config, "utf8").catch(() => "");
  const start = current.indexOf(header);
  const end = start >= 0 ? current.indexOf("\n[", start + header.length) : -1;
  const updated = start < 0
    ? `${current.trimEnd()}${current.trim() ? "\n\n" : ""}${section}`
    : `${current.slice(0, start)}${section}${end < 0 ? "" : current.slice(end + 1)}`;
  await fs.mkdir(path.dirname(config), { recursive: true });
  await fs.writeFile(config, updated, "utf8");
  return `Updated ${header} in ${path.relative(root, config)}`;
}
async function execute(operation: Awaited<ReturnType<typeof nextOperation>>) {
  if (!operation) return false;
  const root = operation.runtime.repo.localPath;
  if (!root) throw new Error("Operation project is not a local folder");
  const payload = operation.payload as Record<string, unknown>;
  if (operation.kind === "install" || operation.kind === "update") {
    const tools = Array.isArray(payload.tools) ? payload.tools.map(String) : ["codex"];
    const modules = Array.isArray(payload.modules) ? payload.modules.map(String) : ["bmm"];
    return runBmadInstaller(root, {
      tools,
      modules,
      userName: typeof payload.userName === "string" ? payload.userName : undefined,
      communicationLanguage: typeof payload.communicationLanguage === "string" ? payload.communicationLanguage : undefined,
      documentOutputLanguage: typeof payload.documentOutputLanguage === "string" ? payload.documentOutputLanguage : undefined,
      outputFolder: typeof payload.outputFolder === "string" ? payload.outputFolder : undefined,
      channel: payload.channel === "next" ? "next" : "stable",
      shims: Boolean(payload.shims),
    });
  }
  if (operation.kind === "set_workflow") {
    const agentIds = Array.isArray(payload.agentIds) ? payload.agentIds.map(String) : [];
    const rawLoops = Array.isArray(payload.loops) ? (payload.loops as Record<string, unknown>[]) : [];
    const agents = await prisma.bmadAgent.findMany({ where: { runtimeId: operation.runtime.id, id: { in: agentIds } } });
    if (agents.length !== agentIds.length) throw new Error("Workflow contains an unknown agent");
    const byId = new Map(agents.map((agent) => [agent.id, agent]));
    const ordered = agentIds.map((id) => byId.get(id)!);
    const workflowPath = safeChild(root, "_bmad/custom/workflow.toml");
    const slugs = ordered.map((agent) => `"${agent.slug}"`).join(", ");

    let toml = `# Managed by Bmad-Manager. Project workflow order and feedback loops.\n[workflow]\nagents = [${slugs}]\n`;
    const savedLoops: Array<{ id: string; fromAgentId: string; toAgentId: string; trigger: string; description?: string }> = [];

    for (const loop of rawLoops) {
      const fromAgent = byId.get(String(loop.fromAgentId));
      const toAgent = byId.get(String(loop.toAgentId));
      if (fromAgent && toAgent) {
        const trigger = String(loop.trigger ?? "verdicts");
        const desc = loop.description ? String(loop.description) : "";
        toml += `\n[[workflow.loops]]\nfrom = "${fromAgent.slug}"\nto = "${toAgent.slug}"\ntrigger = "${trigger}"\n`;
        if (desc) toml += `description = "${desc.replaceAll('"', '\\"')}"\n`;
        savedLoops.push({
          id: String(loop.id || `${fromAgent.id}->${toAgent.id}:${trigger}`),
          fromAgentId: fromAgent.id,
          toAgentId: toAgent.id,
          trigger,
          description: desc,
        });
      }
    }

    await fs.mkdir(path.dirname(workflowPath), { recursive: true });
    await fs.writeFile(workflowPath, toml, "utf8");
    await prisma.bmadProjectRuntime.update({ where: { id: operation.runtime.id }, data: { workflow: { agentIds, loops: savedLoops } } });
    return `Updated workflow with ${ordered.length} agents and ${savedLoops.length} feedback loops`;
  }
  if (operation.kind === "customize_agent") {
    return writeAgentOverride(root, payload);
  }
  if (operation.kind === "write_override") {
    const relative = String(payload.path ?? "");
    if (!validCustomPath(relative) || typeof payload.content !== "string") throw new Error("Invalid customization target");
    const target = safeChild(root, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, payload.content, "utf8");
    return `Wrote ${relative}`;
  }
  if (operation.kind === "create_agent" || operation.kind === "write_skill" || operation.kind === "clone_skill") {
    const slug = String(payload.slug ?? "");
    if (!validSkillSlug(slug)) throw new Error("Invalid managed skill slug");
    const name = String(payload.name ?? slug);
    const title = String(payload.title ?? "Custom BMad Agent");
    const icon = String(payload.icon ?? "🤖");
    const description = String(payload.description ?? "Custom project agent");
    const persona = String(payload.persona ?? description);
    const skillDir = safeChild(root, `.agents/skills/${slug}`);
    await fs.mkdir(skillDir, { recursive: true });
    const skill = typeof payload.content === "string" ? payload.content : `---\nname: ${slug}\ndescription: ${description}\n---\n\n# ${name} — ${title}\n\n<!-- Managed by Bmad-Manager. Customize through Bmad-Manager or _bmad/custom/. -->\n\nYou are ${name}, ${title}.\n\n## Persona\n\n${persona}\n\nWork only on approved project operations. Explain proposed writes before requesting approval.\n`;
    await fs.writeFile(path.join(skillDir, "SKILL.md"), skill, "utf8");
    if (operation.kind === "clone_skill" && payload.assignAgent && typeof payload.assignAgent === "object") await writeAgentOverride(root, payload.assignAgent as Record<string, unknown>);
    if (operation.kind === "create_agent") {
      const personal = payload.scope === "personal";
      const config = safeChild(root, `_bmad/custom/config${personal ? ".user" : ""}.toml`);
      await fs.mkdir(path.dirname(config), { recursive: true });
      const descriptor = `\n[agents.${slug}]\nteam = "custom"\nname = "${name.replaceAll('"', "'")}"\ntitle = "${title.replaceAll('"', "'")}"\nicon = "${icon.replaceAll('"', "'")}"\ndescription = "${description.replaceAll('"', "'")}"\n`;
      await fs.appendFile(config, descriptor, "utf8");
    }
    return `Created managed skill .agents/skills/${slug}/SKILL.md`;
  }
  throw new Error("Unsupported operation");
}

async function rescan(runtimeId: string, root: string) {
  const found = await discoverBmad(root);
  await prisma.$transaction([
    prisma.bmadProjectRuntime.update({ where: { id: runtimeId }, data: { installedVersion: found.installedVersion, installStatus: found.skills.length ? "ready" : "not_installed", tools: [".agents"], modules: ["bmm"], lastScannedAt: new Date() } }),
    prisma.bmadSkill.deleteMany({ where: { runtimeId, isManaged: false } }),
    prisma.bmadAgent.deleteMany({ where: { runtimeId, source: "discovered" } }),
    ...found.skills.map((skill) => prisma.bmadSkill.upsert({ where: { runtimeId_name: { runtimeId, name: skill.name } }, create: { runtimeId, ...skill, isManaged: skill.source === "managed" }, update: { ...skill, isManaged: skill.source === "managed" } })),
    ...found.agents.map((agent) => prisma.bmadAgent.upsert({ where: { runtimeId_slug: { runtimeId, slug: agent.slug } }, create: { runtimeId, ...agent }, update: agent })),
  ]);
}

async function nextOperation() {
  return prisma.bmadOperation.findFirst({ where: { status: "queued" }, orderBy: { approvedAt: "asc" }, include: { runtime: { include: { repo: true } } } });
}

async function run() {
  const operation = await nextOperation();
  if (!operation) return false;
  await prisma.bmadOperation.update({ where: { id: operation.id }, data: { status: "running", startedAt: new Date() } });
  try {
    const output = await execute(operation);
    await rescan(operation.runtime.id, operation.runtime.repo.localPath!);
    await prisma.bmadOperation.update({ where: { id: operation.id }, data: { status: "succeeded", output: redact(String(output)), completedAt: new Date() } });
  } catch (error) {
    await prisma.bmadOperation.update({ where: { id: operation.id }, data: { status: "failed", error: redact(error instanceof Error ? error.message : String(error)), completedAt: new Date() } });
  }
  return true;
}

async function main() {
  do { await new Promise((resolve) => setTimeout(resolve, 1500)); } while (await run());
  setInterval(() => { void run(); }, 3000);
}

void main();