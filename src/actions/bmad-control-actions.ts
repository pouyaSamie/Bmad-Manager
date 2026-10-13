"use server";
import { readCustomization } from "@/lib/project-customization";
import { behaviorSchema } from "@/lib/agent-behavior";
import {
  operationFilePreview,
  assertFileSnapshot,
  type FileChange,
} from "@/lib/operation-files";

import { revalidatePath } from "next/cache";
import fs from "node:fs/promises";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@/generated/prisma/client";
import { getAuthenticatedSession } from "@/lib/db/helpers";
import { sanitizeError } from "@/lib/errors";
import {
  syncProjectBmadRuntime,
  encryptSecret,
  safeChild,
  validCustomPath,
  validSkillSlug,
  discoverBmad,
} from "@/lib/bmad-control";
import { validateGraph } from "@/lib/workflow-graph";
import type { ActionResult } from "@/lib/types";

const projectSchema = z.object({
  owner: z.string().min(1),
  name: z.string().min(1),
});
const gatewaySchema = projectSchema.extend({
  gatewayBaseUrl: z.string().url(),
  gatewayModel: z.string().min(1).max(200),
  apiKey: z.string().max(4096).optional(),
});
const agentGatewaySchema = projectSchema.extend({
  agentId: z.string().min(1),
  route: z.enum([
    "project",
    "agy",
    "gemini",
    "openai",
    "openrouter",
    "ollama",
    "lm-studio",
    "custom",
  ]),
  gatewayBaseUrl: z.string().url().optional(),
  gatewayModel: z.string().min(1).max(200).optional(),
  apiKey: z.string().max(4096).optional(),
});
const operationSchema = projectSchema.extend({
  kind: z.enum([
    "install",
    "update",
    "write_override",
    "create_agent",
    "write_skill",
    "clone_skill",
    "customize_agent",
    "set_workflow",
    "uninstall",
  ]),
  payload: z.record(z.string(), z.unknown()),
});

async function ownedLocalProject(owner: string, name: string) {
  const session = await getAuthenticatedSession();
  if (!session)
    return {
      error: {
        success: false as const,
        error: "Not authenticated",
        code: "UNAUTHORIZED",
      },
      session: null,
      repo: null,
    };
  const repo = await prisma.repo.findFirst({
    where: { userId: session.userId, owner, name },
    select: { id: true, localPath: true, sourceType: true, displayName: true },
  });
  if (!repo)
    return {
      error: {
        success: false as const,
        error: "Project not found",
        code: "NOT_FOUND",
      },
      session,
      repo: null,
    };
  if (repo.sourceType !== "local" || !repo.localPath)
    return {
      error: {
        success: false as const,
        error: "BMad Control is available for local projects only",
        code: "LOCAL_ONLY",
      },
      session,
      repo: null,
    };
  return { error: null, session, repo };
}

async function runtimeFor(repoId: string) {
  return prisma.bmadProjectRuntime.upsert({
    where: { repoId },
    create: { repoId },
    update: {},
  });
}

export async function getBmadControl(
  input: z.infer<typeof projectSchema>,
): Promise<ActionResult<unknown>> {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: "Invalid project", code: "VALIDATION" };
  const result = await ownedLocalProject(parsed.data.owner, parsed.data.name);
  if (result.error || !result.repo) return result.error!;
  try {
    const runtime = await runtimeFor(result.repo.id);
    const [agents, skills, operations, conversations] = await Promise.all([
      prisma.bmadAgent.findMany({
        where: { runtimeId: runtime.id },
        orderBy: { name: "asc" },
      }),
      prisma.bmadSkill.findMany({
        where: { runtimeId: runtime.id },
        orderBy: { name: "asc" },
      }),
      prisma.bmadOperation.findMany({
        where: { runtimeId: runtime.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.bmadConversation.findMany({
        where: { runtimeId: runtime.id },
        include: { agent: true, _count: { select: { messages: true } } },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
    ]);
    const found = await discoverBmad(result.repo.localPath!);
    const safeAgents = await Promise.all(
      agents.map(async ({ encryptedGatewayKey, ...agent }) => ({
        ...agent,
        gatewayConfigured: !!(agent.gatewayBaseUrl && agent.gatewayModel),
        gatewayKeyConfigured: !!encryptedGatewayKey,
        customization: await readCustomization(
          result.repo.localPath!,
          agent.skillName ?? agent.slug,
          skills.find((s) => s.name === agent.skillName)?.customizeSchema ??
            null,
          null,
          agent.slug,
        ),
      })),
    );
    return {
      success: true,
      data: {
        repo: result.repo,
        runtime: {
          ...runtime,
          encryptedGatewayKey: undefined,
          gatewayConfigured: !!runtime.encryptedGatewayKey,
        },
        agents: safeAgents,
        installation: found.profile,
        workerOnline: !!(await prisma.bmadWorkerPresence.findFirst({
          where: { heartbeatAt: { gt: new Date(Date.now() - 45000) } },
        })),
        skills,
        operations,
        conversations,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: sanitizeError(error, "DB_ERROR"),
      code: "DB_ERROR",
    };
  }
}

export async function scanBmadControl(
  input: z.infer<typeof projectSchema>,
): Promise<ActionResult<unknown>> {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: "Invalid project", code: "VALIDATION" };
  const result = await ownedLocalProject(parsed.data.owner, parsed.data.name);
  if (result.error || !result.repo) return result.error!;
  try {
    const { found } = await syncProjectBmadRuntime(
      result.repo.id,
      result.repo.localPath!,
    );
    revalidatePath(`/repo/${parsed.data.owner}/${parsed.data.name}/control`);
    return {
      success: true,
      data: {
        skillCount: found.skills.length,
        agentCount: found.agents.length,
        installedVersion: found.installedVersion,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: sanitizeError(error, "FS_ERROR"),
      code: "SCAN_FAILED",
    };
  }
}

export async function saveGatewayConfig(
  input: z.infer<typeof gatewaySchema>,
): Promise<ActionResult<{ configured: boolean }>> {
  const parsed = gatewaySchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: "Invalid gateway configuration",
      code: "VALIDATION",
    };
  const result = await ownedLocalProject(parsed.data.owner, parsed.data.name);
  if (result.error || !result.repo) return result.error!;
  try {
    const runtime = await runtimeFor(result.repo.id);
    const data: {
      gatewayBaseUrl: string;
      gatewayModel: string;
      encryptedGatewayKey?: string;
    } = {
      gatewayBaseUrl: parsed.data.gatewayBaseUrl.replace(/\/$/, ""),
      gatewayModel: parsed.data.gatewayModel,
    };
    if (parsed.data.apiKey?.trim())
      data.encryptedGatewayKey = encryptSecret(parsed.data.apiKey.trim());
    await prisma.bmadProjectRuntime.update({ where: { id: runtime.id }, data });
    revalidatePath(`/repo/${parsed.data.owner}/${parsed.data.name}/control`);
    return {
      success: true,
      data: {
        configured: !!(data.encryptedGatewayKey || runtime.encryptedGatewayKey),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: sanitizeError(error, "DB_ERROR"),
      code: "GATEWAY_SAVE_FAILED",
    };
  }
}

export async function saveAgentGatewayConfig(
  input: z.infer<typeof agentGatewaySchema>,
): Promise<ActionResult<{ configured: boolean }>> {
  const parsed = agentGatewaySchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: "Invalid agent routing configuration",
      code: "VALIDATION",
    };
  const result = await ownedLocalProject(parsed.data.owner, parsed.data.name);
  if (result.error || !result.repo) return result.error!;
  try {
    const runtime = await runtimeFor(result.repo.id);
    const agent = await prisma.bmadAgent.findFirst({
      where: { id: parsed.data.agentId, runtimeId: runtime.id },
    });
    if (!agent)
      return { success: false, error: "Agent not found", code: "NOT_FOUND" };
    if (parsed.data.route === "project") {
      await prisma.bmadAgent.update({
        where: { id: agent.id },
        data: {
          providerLabel: null,
          gatewayBaseUrl: null,
          gatewayModel: null,
          encryptedGatewayKey: null,
        },
      });
      revalidatePath(`/repo/${parsed.data.owner}/${parsed.data.name}/control`);
      return { success: true, data: { configured: false } };
    }
    if (!parsed.data.gatewayBaseUrl || !parsed.data.gatewayModel)
      return {
        success: false,
        error: "A gateway URL and model are required",
        code: "VALIDATION",
      };
    const routeLabels: Record<string, string> = {
      agy: "Antigravity (AGY)",
      gemini: "Google Gemini",
      openai: "OpenAI / Codex API",
      openrouter: "OpenRouter",
      ollama: "Ollama",
      "lm-studio": "LM Studio",
      custom: "OpenAI-compatible",
    };
    const data: {
      providerLabel: string;
      gatewayBaseUrl: string;
      gatewayModel: string;
      encryptedGatewayKey?: string;
    } = {
      providerLabel: routeLabels[parsed.data.route],
      gatewayBaseUrl: parsed.data.gatewayBaseUrl.replace(/\/$/, ""),
      gatewayModel: parsed.data.gatewayModel,
    };
    if (parsed.data.apiKey?.trim())
      data.encryptedGatewayKey = encryptSecret(parsed.data.apiKey.trim());
    await prisma.bmadAgent.update({ where: { id: agent.id }, data });
    revalidatePath(`/repo/${parsed.data.owner}/${parsed.data.name}/control`);
    return { success: true, data: { configured: true } };
  } catch (error) {
    return {
      success: false,
      error: sanitizeError(error, "DB_ERROR"),
      code: "AGENT_GATEWAY_SAVE_FAILED",
    };
  }
}
function preview(kind: string, payload: Record<string, unknown>) {
  if (kind === "uninstall")
    return {
      summary: "Uninstall BMad and unlink project",
      writes: ["_bmad/", "_bmad-output/", ".agents/skills/"],
      preserves: ["Source code", "Git repository"],
    };
  if (kind === "install" || kind === "update") {
    const tools = Array.isArray(payload.tools)
      ? payload.tools.join(",")
      : "codex";
    const modules = Array.isArray(payload.modules)
      ? payload.modules.join(",")
      : "bmm";
    return {
      command: `npx bmad-method@6.12.0 install --yes --action ${kind === "update" ? "update" : "install"} --directory <projectRoot> --modules ${modules} --tools ${tools}`,
      writes: ["_bmad/", ".agents/skills/"],
    };
  }
  if (kind === "write_override")
    return {
      file: payload.path,
      content: payload.content,
      writes: [payload.path],
    };
  if (kind === "create_agent")
    return {
      files: [
        `.agents/skills/${String(payload.slug)}/SKILL.md`,
        `_bmad/custom/config${payload.scope === "personal" ? ".user" : ""}.toml`,
      ],
      writes: ["managed custom agent"],
    };
  if (kind === "customize_agent")
    return {
      files: [
        `_bmad/custom/config${payload.scope === "personal" ? ".user" : ""}.toml`,
        `_bmad/custom/${String(payload.skillName)}${payload.scope === "personal" ? ".user" : ""}.toml`,
        ...(payload.scope === "personal" ? [".gitignore"] : []),
      ],
      file: `_bmad/custom/config${payload.scope === "personal" ? ".user" : ""}.toml`,
      agent: payload.slug,
      skill: payload.skillName,
      writes: [
        "agent descriptor and per-skill behavior override",
        ...(payload.scope === "personal"
          ? [".gitignore personal override rule"]
          : []),
      ],
    };
  if (kind === "clone_skill")
    return {
      file: `.agents/skills/${String(payload.slug)}/SKILL.md`,
      source: payload.sourceDirectory,
      assignTo:
        (payload.assignAgent as { name?: string } | undefined)?.name ?? null,
      writes: ["managed skill clone"],
    };
  if (kind === "set_workflow")
    return {
      file: "_bmad/custom/workflow.toml",
      summary: payload.summary,
      graph: payload.graph,
      writes: ["Manager workflow design; no execution"],
    };
  return {
    file: `.agents/skills/${String(payload.slug)}/SKILL.md`,
    writes: ["managed custom skill"],
  };
}

export async function draftBmadOperation(
  input: z.infer<typeof operationSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = operationSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: "Invalid operation", code: "VALIDATION" };
  const result = await ownedLocalProject(parsed.data.owner, parsed.data.name);
  if (result.error || !result.repo || !result.session) return result.error!;
  let payload = parsed.data.payload;
  if (
    parsed.data.kind === "write_override" &&
    (!validCustomPath(String(payload.path)) ||
      typeof payload.content !== "string")
  )
    return {
      success: false,
      error: "Overrides may only target _bmad/custom/*.toml",
      code: "INVALID_PATH",
    };
  if (
    (parsed.data.kind === "create_agent" ||
      parsed.data.kind === "write_skill" ||
      parsed.data.kind === "clone_skill") &&
    !validSkillSlug(String(payload.slug))
  )
    return {
      success: false,
      error: "Invalid skill slug",
      code: "INVALID_SKILL",
    };
  if (
    parsed.data.kind === "clone_skill" &&
    (typeof payload.content !== "string" || payload.content.length > 200000)
  )
    return {
      success: false,
      error: "Invalid skill content",
      code: "VALIDATION",
    };
  if (parsed.data.kind === "clone_skill" && payload.assignAgentId) {
    const runtime = await runtimeFor(result.repo.id);
    const agent = await prisma.bmadAgent.findFirst({
      where: { id: String(payload.assignAgentId), runtimeId: runtime.id },
    });
    if (!agent)
      return {
        success: false,
        error: "Assigned agent not found",
        code: "NOT_FOUND",
      };
    payload = {
      ...payload,
      assignAgent: {
        slug: agent.slug,
        name: agent.name,
        title: agent.title,
        icon: agent.icon,
        description: agent.description ?? "",
        persona: typeof agent.persona === "string" ? agent.persona : "",
        scope: agent.scope,
        skillName: String(payload.slug),
      },
    };
  }
  if (parsed.data.kind === "set_workflow") {
    try {
      const graph = validateGraph(payload.graph);
      const runtime = await runtimeFor(result.repo.id);
      const known = await prisma.bmadAgent.findMany({
        where: { runtimeId: runtime.id, available: true },
      });
      if (graph.nodes.some((n) => !known.some((a) => a.slug === n.agentSlug)))
        return {
          success: false,
          error: "Workflow contains unavailable agents",
          code: "VALIDATION",
        };
      payload = {
        graph,
        summary: graph.nodes
          .map((n) => known.find((a) => a.slug === n.agentSlug)?.name)
          .join(" → "),
      };
    } catch {
      return {
        success: false,
        error: "Check workflow connections and feedback settings",
        code: "VALIDATION",
      };
    }
  }
  if (parsed.data.kind === "customize_agent") {
    if (
      !validSkillSlug(String(payload.slug)) ||
      !validSkillSlug(String(payload.skillName))
    )
      return {
        success: false,
        error: "Invalid agent or skill",
        code: "VALIDATION",
      };
    const runtime = await runtimeFor(result.repo.id);
    const agent = await prisma.bmadAgent.findFirst({
      where: { id: String(payload.agentId), runtimeId: runtime.id },
    });
    if (!agent || agent.slug !== payload.slug)
      return { success: false, error: "Agent not found", code: "NOT_FOUND" };
    const skill = await prisma.bmadSkill.findFirst({
      where: {
        runtimeId: runtime.id,
        name: String(payload.skillName),
        source: { not: "missing" },
      },
    });
    if (!skill)
      return {
        success: false,
        error: "Attached skill is unavailable",
        code: "VALIDATION",
      };
    if (
      payload.behaviorPatch &&
      !behaviorSchema.safeParse(payload.behaviorPatch).success
    )
      return {
        success: false,
        error: "Invalid behavior fields",
        code: "VALIDATION",
      };
    for (const field of ["name", "title", "icon", "description", "persona"])
      if (
        payload[field] !== undefined &&
        (typeof payload[field] !== "string" ||
          String(payload[field]).length > 8000)
      )
        return {
          success: false,
          error: "Invalid agent customization",
          code: "VALIDATION",
        };
  }
  try {
    const runtime = await runtimeFor(result.repo.id);
    if (parsed.data.kind === "update") {
      const found = await discoverBmad(result.repo.localPath!);
      if (!found.profile.canUpdate)
        return {
          success: false,
          error: found.profile.reason,
          code: "UNSUPPORTED_INSTALLATION",
        };
      payload = {
        ...payload,
        tools: found.profile.tools,
        modules: found.profile.modules,
        profile: found.profile,
        ...{
          userName: found.profile.settings.user_name,
          communicationLanguage: found.profile.settings.communication_language,
          documentOutputLanguage:
            found.profile.settings.document_output_language,
          outputFolder: found.profile.settings.output_folder?.replace(
            /^\{project-root\}[/\\]/,
            "",
          ),
        },
      };
    }
    const fileChanges = await operationFilePreview(
      result.repo.localPath!,
      parsed.data.kind,
      payload,
    );
    const operation = await prisma.bmadOperation.create({
      data: {
        runtimeId: runtime.id,
        kind: parsed.data.kind,
        payload: payload as Prisma.InputJsonValue,
        preview: {
          ...preview(parsed.data.kind, payload),
          version: 2,
          fileChanges,
        } as unknown as Prisma.InputJsonValue,
        createdById: result.session.userId,
      },
    });
    revalidatePath(`/repo/${parsed.data.owner}/${parsed.data.name}/control`);
    return { success: true, data: { id: operation.id } };
  } catch (error) {
    return {
      success: false,
      error: sanitizeError(error, "DB_ERROR"),
      code: "OPERATION_CREATE_FAILED",
    };
  }
}

export async function getBmadSkillContent(input: {
  owner: string;
  name: string;
  skillId: string;
}): Promise<
  ActionResult<{
    name: string;
    directory: string;
    content: string;
    isManaged: boolean;
  }>
> {
  const parsed = z
    .object({
      owner: z.string().min(1),
      name: z.string().min(1),
      skillId: z.string().min(1),
    })
    .safeParse(input);
  if (!parsed.success)
    return { success: false, error: "Invalid skill", code: "VALIDATION" };
  const result = await ownedLocalProject(parsed.data.owner, parsed.data.name);
  if (result.error || !result.repo) return result.error!;
  try {
    const runtime = await runtimeFor(result.repo.id);
    const skill = await prisma.bmadSkill.findFirst({
      where: { id: parsed.data.skillId, runtimeId: runtime.id },
    });
    if (!skill)
      return { success: false, error: "Skill not found", code: "NOT_FOUND" };
    const content = await fs.readFile(
      safeChild(result.repo.localPath!, `${skill.directory}/SKILL.md`),
      "utf8",
    );
    return {
      success: true,
      data: {
        name: skill.name,
        directory: skill.directory,
        content,
        isManaged: skill.isManaged,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: sanitizeError(error, "FS_ERROR"),
      code: "SKILL_READ_FAILED",
    };
  }
}
export async function approveBmadOperation(input: {
  owner: string;
  name: string;
  operationId: string;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = z
    .object({
      owner: z.string(),
      name: z.string(),
      operationId: z.string().min(1),
    })
    .safeParse(input);
  if (!parsed.success)
    return { success: false, error: "Invalid operation", code: "VALIDATION" };
  const result = await ownedLocalProject(parsed.data.owner, parsed.data.name);
  if (result.error || !result.repo || !result.session) return result.error!;
  const runtime = await runtimeFor(result.repo.id);
  const candidate = await prisma.bmadOperation.findFirst({
    where: {
      id: parsed.data.operationId,
      runtimeId: runtime.id,
      status: "draft",
    },
  });
  const changes = candidate?.preview as {
    version?: number;
    fileChanges?: FileChange[];
  } | null;
  if (changes?.version !== 2)
    return {
      success: false,
      error: "Create a new reviewed draft for this legacy operation",
      code: "LEGACY_DRAFT",
    };
  try {
    await assertFileSnapshot(result.repo.localPath!, changes.fileChanges ?? []);
  } catch {
    return {
      success: false,
      error:
        "Files changed since this draft. Create a new draft before approval.",
      code: "STALE_DRAFT",
    };
  }
  const operation = await prisma.bmadOperation.updateMany({
    where: {
      id: parsed.data.operationId,
      runtimeId: runtime.id,
      status: "draft",
    },
    data: {
      status: "queued",
      approvedById: result.session.userId,
      approvedAt: new Date(),
    },
  });
  if (!operation.count)
    return {
      success: false,
      error: "Operation is no longer awaiting approval",
      code: "INVALID_STATE",
    };
  revalidatePath(`/repo/${parsed.data.owner}/${parsed.data.name}/control`);
  return { success: true, data: { id: parsed.data.operationId } };
}

export async function discardBmadOperation(input: {
  owner: string;
  name: string;
  operationId: string;
}): Promise<ActionResult<{ discarded: boolean }>> {
  const v = projectSchema
    .extend({ operationId: z.string().min(1) })
    .safeParse(input);
  if (!v.success) return { success: false, error: "Invalid change" };
  const result = await ownedLocalProject(v.data.owner, v.data.name);
  if (result.error || !result.repo) return result.error!;
  try {
    const runtime = await runtimeFor(result.repo.id);
    const changed = await prisma.bmadOperation.updateMany({
      where: { id: v.data.operationId, runtimeId: runtime.id, status: "draft" },
      data: { status: "discarded", completedAt: new Date() },
    });
    if (!changed.count)
      return { success: false, error: "Only draft changes can be discarded" };
    revalidatePath("/repo/" + v.data.owner + "/" + v.data.name + "/settings");
    return { success: true, data: { discarded: true } };
  } catch (e) {
    return { success: false, error: sanitizeError(e, "DB_ERROR") };
  }
}

export async function getConversationMessages(input: {
  owner: string;
  name: string;
  agentId: string;
  conversationId: string;
  before?: string;
}) {
  const v = projectSchema
    .extend({
      agentId: z.string().min(1),
      conversationId: z.string().min(1),
      before: z.string().min(1).optional(),
    })
    .safeParse(input);
  if (!v.success)
    return { success: false as const, error: "Invalid conversation" };
  const owned = await ownedLocalProject(v.data.owner, v.data.name);
  if (owned.error || !owned.repo) return owned.error!;
  try {
    const conversation = await prisma.bmadConversation.findFirst({
      where: {
        id: v.data.conversationId,
        agentId: v.data.agentId,
        runtime: { repoId: owned.repo.id },
      },
    });
    if (!conversation)
      return {
        success: false as const,
        error: "Conversation not found for this agent",
      };
    if (
      v.data.before &&
      !(await prisma.bmadMessage.findFirst({
        where: { id: v.data.before, conversationId: conversation.id },
      }))
    )
      return { success: false as const, error: "Invalid conversation page" };
    const rows = await prisma.bmadMessage.findMany({
      where: {
        conversationId: conversation.id,
      },
      ...(v.data.before ? { cursor: { id: v.data.before }, skip: 1 } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 51,
    });
    const hasMore = rows.length > 50;
    const messages = rows.slice(0, 50).reverse();
    return {
      success: true as const,
      data: {
        messages,
        nextBefore: hasMore ? messages[0].id : null,
      },
    };
  } catch (e) {
    return { success: false as const, error: sanitizeError(e, "DB_ERROR") };
  }
}

export async function releaseAbandonedOperation(input: {
  owner: string;
  name: string;
  operationId: string;
  confirmedStopped: boolean;
}) {
  const v = projectSchema
    .extend({
      operationId: z.string().min(1),
      confirmedStopped: z.literal(true),
    })
    .safeParse(input);
  if (!v.success)
    return {
      success: false as const,
      error:
        "Confirm the old worker is stopped and partial files have been checked",
    };
  const owned = await ownedLocalProject(v.data.owner, v.data.name);
  if (owned.error || !owned.repo) return owned.error!;
  try {
    const op = await prisma.bmadOperation.findFirst({
      where: {
        id: v.data.operationId,
        status: "failed",
        runtime: { repoId: owned.repo.id },
      },
    });
    if (!op)
      return { success: false as const, error: "Failed operation not found" };
    const result = await prisma.bmadWorkerLease.deleteMany({
      where: { operationId: op.id, expiresAt: { lt: new Date() } },
    });
    if (!result.count)
      return {
        success: false as const,
        error: "The lock is active or already released",
      };
    revalidatePath("/repo/" + v.data.owner + "/" + v.data.name + "/settings");
    return { success: true as const, data: { released: true } };
  } catch (e) {
    return { success: false as const, error: sanitizeError(e, "DB_ERROR") };
  }
}
