"use server";

import { revalidatePath } from "next/cache";
import fs from "node:fs/promises";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@/generated/prisma/client";
import { getAuthenticatedSession } from "@/lib/db/helpers";
import { sanitizeError } from "@/lib/errors";
import { decryptSecret, discoverBmad, encryptSecret, safeChild, validCustomPath, validSkillSlug } from "@/lib/bmad-control";
import type { ActionResult } from "@/lib/types";

const projectSchema = z.object({ owner: z.string().min(1), name: z.string().min(1) });
const gatewaySchema = projectSchema.extend({ gatewayBaseUrl: z.string().url(), gatewayModel: z.string().min(1).max(200), apiKey: z.string().max(4096).optional() });
const agentGatewaySchema = projectSchema.extend({ agentId: z.string().min(1), route: z.enum(["project", "openai", "openrouter", "ollama", "lm-studio", "custom"]), gatewayBaseUrl: z.string().url().optional(), gatewayModel: z.string().min(1).max(200).optional(), apiKey: z.string().max(4096).optional() });
const operationSchema = projectSchema.extend({ kind: z.enum(["install", "update", "write_override", "create_agent", "write_skill", "clone_skill", "customize_agent", "set_workflow"]), payload: z.record(z.string(), z.unknown()) });

async function ownedLocalProject(owner: string, name: string) {
  const session = await getAuthenticatedSession();
  if (!session) return { error: { success: false as const, error: "Not authenticated", code: "UNAUTHORIZED" }, session: null, repo: null };
  const repo = await prisma.repo.findFirst({ where: { userId: session.userId, owner, name }, select: { id: true, localPath: true, sourceType: true, displayName: true } });
  if (!repo) return { error: { success: false as const, error: "Project not found", code: "NOT_FOUND" }, session, repo: null };
  if (repo.sourceType !== "local" || !repo.localPath) return { error: { success: false as const, error: "BMad Control is available for local projects only", code: "LOCAL_ONLY" }, session, repo: null };
  return { error: null, session, repo };
}

async function runtimeFor(repoId: string) {
  return prisma.bmadProjectRuntime.upsert({ where: { repoId }, create: { repoId }, update: {} });
}

export async function getBmadControl(input: z.infer<typeof projectSchema>): Promise<ActionResult<unknown>> {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid project", code: "VALIDATION" };
  const result = await ownedLocalProject(parsed.data.owner, parsed.data.name);
  if (result.error || !result.repo) return result.error!;
  try {
    const runtime = await runtimeFor(result.repo.id);
    const [agents, skills, operations, conversations] = await Promise.all([
      prisma.bmadAgent.findMany({ where: { runtimeId: runtime.id }, orderBy: { name: "asc" } }),
      prisma.bmadSkill.findMany({ where: { runtimeId: runtime.id }, orderBy: { name: "asc" } }),
      prisma.bmadOperation.findMany({ where: { runtimeId: runtime.id }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.bmadConversation.findMany({ where: { runtimeId: runtime.id }, include: { agent: true, _count: { select: { messages: true } } }, orderBy: { updatedAt: "desc" }, take: 20 }),
    ]);
    const safeAgents = agents.map(({ encryptedGatewayKey, ...agent }) => ({ ...agent, gatewayConfigured: !!(agent.gatewayBaseUrl && agent.gatewayModel), gatewayKeyConfigured: !!encryptedGatewayKey }));
    return { success: true, data: { repo: result.repo, runtime: { ...runtime, encryptedGatewayKey: undefined, gatewayConfigured: !!runtime.encryptedGatewayKey }, agents: safeAgents, skills, operations, conversations } };
  } catch (error) { return { success: false, error: sanitizeError(error, "DB_ERROR"), code: "DB_ERROR" }; }
}

export async function scanBmadControl(input: z.infer<typeof projectSchema>): Promise<ActionResult<unknown>> {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid project", code: "VALIDATION" };
  const result = await ownedLocalProject(parsed.data.owner, parsed.data.name);
  if (result.error || !result.repo) return result.error!;
  try {
    const runtime = await runtimeFor(result.repo.id);
    const found = await discoverBmad(result.repo.localPath!);
    await prisma.$transaction([
      prisma.bmadProjectRuntime.update({ where: { id: runtime.id }, data: { installedVersion: found.installedVersion, installStatus: found.skills.length ? "ready" : "not_installed", tools: [".agents"], modules: ["bmm"], lastScannedAt: new Date() } }),
      prisma.bmadSkill.deleteMany({ where: { runtimeId: runtime.id, isManaged: false } }),
      prisma.bmadAgent.deleteMany({ where: { runtimeId: runtime.id, source: "discovered" } }),
      ...found.skills.map((skill) => prisma.bmadSkill.upsert({ where: { runtimeId_name: { runtimeId: runtime.id, name: skill.name } }, create: { runtimeId: runtime.id, ...skill, isManaged: skill.source === "managed" }, update: { ...skill, isManaged: skill.source === "managed" } })),
      ...found.agents.map((agent) => prisma.bmadAgent.upsert({ where: { runtimeId_slug: { runtimeId: runtime.id, slug: agent.slug } }, create: { runtimeId: runtime.id, ...agent }, update: agent })),
    ]);
    revalidatePath(`/repo/${parsed.data.owner}/${parsed.data.name}/control`);
    return { success: true, data: { skillCount: found.skills.length, agentCount: found.agents.length, installedVersion: found.installedVersion } };
  } catch (error) { return { success: false, error: sanitizeError(error, "FS_ERROR"), code: "SCAN_FAILED" }; }
}

export async function saveGatewayConfig(input: z.infer<typeof gatewaySchema>): Promise<ActionResult<{ configured: boolean }>> {
  const parsed = gatewaySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid gateway configuration", code: "VALIDATION" };
  const result = await ownedLocalProject(parsed.data.owner, parsed.data.name);
  if (result.error || !result.repo) return result.error!;
  try {
    const runtime = await runtimeFor(result.repo.id);
    const data: { gatewayBaseUrl: string; gatewayModel: string; encryptedGatewayKey?: string } = { gatewayBaseUrl: parsed.data.gatewayBaseUrl.replace(/\/$/, ""), gatewayModel: parsed.data.gatewayModel };
    if (parsed.data.apiKey?.trim()) data.encryptedGatewayKey = encryptSecret(parsed.data.apiKey.trim());
    await prisma.bmadProjectRuntime.update({ where: { id: runtime.id }, data });
    revalidatePath(`/repo/${parsed.data.owner}/${parsed.data.name}/control`);
    return { success: true, data: { configured: !!(data.encryptedGatewayKey || runtime.encryptedGatewayKey) } };
  } catch (error) { return { success: false, error: sanitizeError(error, "DB_ERROR"), code: "GATEWAY_SAVE_FAILED" }; }
}

export async function saveAgentGatewayConfig(input: z.infer<typeof agentGatewaySchema>): Promise<ActionResult<{ configured: boolean }>> {
  const parsed = agentGatewaySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid agent routing configuration", code: "VALIDATION" };
  const result = await ownedLocalProject(parsed.data.owner, parsed.data.name);
  if (result.error || !result.repo) return result.error!;
  try {
    const runtime = await runtimeFor(result.repo.id);
    const agent = await prisma.bmadAgent.findFirst({ where: { id: parsed.data.agentId, runtimeId: runtime.id } });
    if (!agent) return { success: false, error: "Agent not found", code: "NOT_FOUND" };
    if (parsed.data.route === "project") {
      await prisma.bmadAgent.update({ where: { id: agent.id }, data: { providerLabel: null, gatewayBaseUrl: null, gatewayModel: null, encryptedGatewayKey: null } });
      revalidatePath(`/repo/${parsed.data.owner}/${parsed.data.name}/control`);
      return { success: true, data: { configured: false } };
    }
    if (!parsed.data.gatewayBaseUrl || !parsed.data.gatewayModel) return { success: false, error: "A gateway URL and model are required", code: "VALIDATION" };
    const routeLabels: Record<string, string> = { openai: "OpenAI / Codex API", openrouter: "OpenRouter", ollama: "Ollama", "lm-studio": "LM Studio", custom: "OpenAI-compatible" };
    const data: { providerLabel: string; gatewayBaseUrl: string; gatewayModel: string; encryptedGatewayKey?: string } = { providerLabel: routeLabels[parsed.data.route], gatewayBaseUrl: parsed.data.gatewayBaseUrl.replace(/\/$/, ""), gatewayModel: parsed.data.gatewayModel };
    if (parsed.data.apiKey?.trim()) data.encryptedGatewayKey = encryptSecret(parsed.data.apiKey.trim());
    await prisma.bmadAgent.update({ where: { id: agent.id }, data });
    revalidatePath(`/repo/${parsed.data.owner}/${parsed.data.name}/control`);
    return { success: true, data: { configured: true } };
  } catch (error) { return { success: false, error: sanitizeError(error, "DB_ERROR"), code: "AGENT_GATEWAY_SAVE_FAILED" }; }
}
function preview(kind: string, payload: Record<string, unknown>) {
  if (kind === "install" || kind === "update") return { command: "npx bmad-method install --yes --modules bmm --tools <selected-tools>", writes: ["_bmad/", ".agents/skills/"] };
  if (kind === "write_override") return { file: payload.path, content: payload.content, writes: [payload.path] };
  if (kind === "create_agent") return { files: [`.agents/skills/${String(payload.slug)}/SKILL.md`, `_bmad/custom/config${payload.scope === "personal" ? ".user" : ""}.toml`], writes: ["managed custom agent"] };
  if (kind === "customize_agent") return { file: `_bmad/custom/config${payload.scope === "personal" ? ".user" : ""}.toml`, agent: payload.slug, skill: payload.skillName, writes: ["agent override only"] };
  if (kind === "clone_skill") return { file: `.agents/skills/${String(payload.slug)}/SKILL.md`, source: payload.sourceDirectory, assignTo: (payload.assignAgent as { name?: string } | undefined)?.name ?? null, writes: ["managed skill clone"] };
  if (kind === "set_workflow") return { file: "_bmad/custom/workflow.toml", agentIds: payload.agentIds, writes: ["project workflow override"] };
  return { file: `.agents/skills/${String(payload.slug)}/SKILL.md`, writes: ["managed custom skill"] };
}

export async function draftBmadOperation(input: z.infer<typeof operationSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = operationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid operation", code: "VALIDATION" };
  const result = await ownedLocalProject(parsed.data.owner, parsed.data.name);
  if (result.error || !result.repo || !result.session) return result.error!;
  let payload = parsed.data.payload;
  if (parsed.data.kind === "write_override" && (!validCustomPath(String(payload.path)) || typeof payload.content !== "string")) return { success: false, error: "Overrides may only target _bmad/custom/*.toml", code: "INVALID_PATH" };
  if ((parsed.data.kind === "create_agent" || parsed.data.kind === "write_skill" || parsed.data.kind === "clone_skill") && !validSkillSlug(String(payload.slug))) return { success: false, error: "Invalid skill slug", code: "INVALID_SKILL" };
  if (parsed.data.kind === "clone_skill" && (typeof payload.content !== "string" || payload.content.length > 200000)) return { success: false, error: "Invalid skill content", code: "VALIDATION" };
  if (parsed.data.kind === "clone_skill" && payload.assignAgentId) {
    const runtime = await runtimeFor(result.repo.id);
    const agent = await prisma.bmadAgent.findFirst({ where: { id: String(payload.assignAgentId), runtimeId: runtime.id } });
    if (!agent) return { success: false, error: "Assigned agent not found", code: "NOT_FOUND" };
    payload = { ...payload, assignAgent: { slug: agent.slug, name: agent.name, title: agent.title, icon: agent.icon, description: agent.description ?? "", persona: typeof agent.persona === "string" ? agent.persona : "", scope: agent.scope, skillName: String(payload.slug) } };
  }
  if (parsed.data.kind === "set_workflow") {
    const agentIds = Array.isArray(payload.agentIds) ? payload.agentIds.map(String) : [];
    if (!agentIds.length || agentIds.length > 20 || new Set(agentIds).size !== agentIds.length) return { success: false, error: "A workflow needs unique project agents", code: "VALIDATION" };
    const runtime = await runtimeFor(result.repo.id);
    const count = await prisma.bmadAgent.count({ where: { runtimeId: runtime.id, id: { in: agentIds } } });
    if (count !== agentIds.length) return { success: false, error: "Workflow contains an unknown agent", code: "VALIDATION" };
    payload = { agentIds };
  }
  if (parsed.data.kind === "customize_agent") {
    if (!validSkillSlug(String(payload.slug)) || !validSkillSlug(String(payload.skillName))) return { success: false, error: "Invalid agent or skill", code: "VALIDATION" };
    const runtime = await runtimeFor(result.repo.id);
    const agent = await prisma.bmadAgent.findFirst({ where: { id: String(payload.agentId), runtimeId: runtime.id } });
    if (!agent) return { success: false, error: "Agent not found", code: "NOT_FOUND" };
    for (const field of ["name", "title", "icon", "description", "persona"]) if (typeof payload[field] !== "string" || String(payload[field]).length > 8000) return { success: false, error: "Invalid agent customization", code: "VALIDATION" };
  }
  try {
    const runtime = await runtimeFor(result.repo.id);
    const operation = await prisma.bmadOperation.create({ data: { runtimeId: runtime.id, kind: parsed.data.kind, payload: payload as Prisma.InputJsonValue, preview: preview(parsed.data.kind, payload) as Prisma.InputJsonValue, createdById: result.session.userId } });
    revalidatePath(`/repo/${parsed.data.owner}/${parsed.data.name}/control`);
    return { success: true, data: { id: operation.id } };
  } catch (error) { return { success: false, error: sanitizeError(error, "DB_ERROR"), code: "OPERATION_CREATE_FAILED" }; }
}

export async function getBmadSkillContent(input: { owner: string; name: string; skillId: string }): Promise<ActionResult<{ name: string; directory: string; content: string; isManaged: boolean }>> {
  const parsed = z.object({ owner: z.string().min(1), name: z.string().min(1), skillId: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid skill", code: "VALIDATION" };
  const result = await ownedLocalProject(parsed.data.owner, parsed.data.name);
  if (result.error || !result.repo) return result.error!;
  try {
    const runtime = await runtimeFor(result.repo.id);
    const skill = await prisma.bmadSkill.findFirst({ where: { id: parsed.data.skillId, runtimeId: runtime.id } });
    if (!skill) return { success: false, error: "Skill not found", code: "NOT_FOUND" };
    const content = await fs.readFile(safeChild(result.repo.localPath!, `${skill.directory}/SKILL.md`), "utf8");
    return { success: true, data: { name: skill.name, directory: skill.directory, content, isManaged: skill.isManaged } };
  } catch (error) { return { success: false, error: sanitizeError(error, "FS_ERROR"), code: "SKILL_READ_FAILED" }; }
}
export async function approveBmadOperation(input: { owner: string; name: string; operationId: string }): Promise<ActionResult<{ id: string }>> {
  const parsed = z.object({ owner: z.string(), name: z.string(), operationId: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid operation", code: "VALIDATION" };
  const result = await ownedLocalProject(parsed.data.owner, parsed.data.name);
  if (result.error || !result.repo || !result.session) return result.error!;
  const runtime = await runtimeFor(result.repo.id);
  const operation = await prisma.bmadOperation.updateMany({ where: { id: parsed.data.operationId, runtimeId: runtime.id, status: "draft" }, data: { status: "queued", approvedById: result.session.userId, approvedAt: new Date() } });
  if (!operation.count) return { success: false, error: "Operation is no longer awaiting approval", code: "INVALID_STATE" };
  revalidatePath(`/repo/${parsed.data.owner}/${parsed.data.name}/control`);
  return { success: true, data: { id: parsed.data.operationId } };
}

export async function getGatewayForChat(repoId: string, userId: string, agentId: string) {
  const runtime = await prisma.bmadProjectRuntime.findFirst({ where: { repo: { id: repoId, userId } }, include: { agents: true } });
  const agent = runtime?.agents.find((item) => item.id === agentId);
  if (!runtime || !agent) return null;
  const gatewayBaseUrl = agent.gatewayBaseUrl ?? runtime.gatewayBaseUrl;
  const gatewayModel = agent.gatewayModel ?? runtime.gatewayModel;
  const encryptedGatewayKey = agent.encryptedGatewayKey ?? runtime.encryptedGatewayKey;
  if (!gatewayBaseUrl || !gatewayModel) return null;
  return { runtime, agent, gatewayBaseUrl, gatewayModel, providerLabel: agent.providerLabel ?? "Project default", apiKey: encryptedGatewayKey ? decryptSecret(encryptedGatewayKey) : "" };
}