"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { getAuthenticatedSession } from "@/lib/db/helpers";
import { encryptSecret, decryptSecret } from "@/lib/bmad-control";
import { sanitizeError } from "@/lib/errors";
import {
  providerSchema,
  requestHeaders,
  validateEndpoint,
  type ModelOption,
} from "@/lib/providers";
import type { ActionResult } from "@/lib/types";
const connectionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  provider: providerSchema,
  baseUrl: z.string().url(),
  apiKey: z.string().max(4096).optional(),
  clearKey: z.boolean().optional(),
});
export async function listConnections() {
  const session = await getAuthenticatedSession();
  if (!session) return { success: false as const, error: "Sign in required" };
  try {
    const rows = await prisma.bmadConnection.findMany({
      where: { userId: session.userId },
      orderBy: { name: "asc" },
    });
    return {
      success: true as const,
      data: rows.map(({ encryptedKey, ...row }) => ({
        ...row,
        hasKey: !!encryptedKey,
        models: row.models as ModelOption[] | null,
      })),
    };
  } catch (e) {
    return { success: false as const, error: sanitizeError(e, "DB_ERROR") };
  }
}
export async function saveConnection(
  input: z.infer<typeof connectionSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = connectionSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: "Check the connection fields",
      code: "VALIDATION",
    };
  const s = await getAuthenticatedSession();
  if (!s) return { success: false, error: "Sign in required" };
  try {
    const v = parsed.data;
    const old = v.id
      ? await prisma.bmadConnection.findFirst({
          where: { id: v.id, userId: s.userId },
        })
      : null;
    if (v.id && !old) return { success: false, error: "Connection not found" };
    const baseUrl = validateEndpoint(v.baseUrl);
    const changed =
      !!old && (old.baseUrl !== baseUrl || old.provider !== v.provider);
    const encryptedKey = v.clearKey
      ? null
      : v.apiKey
        ? encryptSecret(v.apiKey)
        : changed
          ? null
          : old?.encryptedKey;
    const data = {
      name: v.name,
      provider: v.provider,
      baseUrl,
      encryptedKey,
      status: "unverified",
      checkedAt: null,
      models: [],
    };
    const row = old
      ? await prisma.bmadConnection.update({ where: { id: old.id }, data })
      : await prisma.bmadConnection.create({
          data: { ...data, userId: s.userId },
        });
    revalidatePath("/connections");
    return { success: true, data: { id: row.id } };
  } catch (e) {
    return {
      success: false,
      error: sanitizeError(e, "DB_ERROR"),
      code: "CONNECTION_SAVE_FAILED",
    };
  }
}
export async function checkConnection(input: {
  id: string;
}): Promise<ActionResult<{ models: ModelOption[]; status: string }>> {
  const v = z.object({ id: z.string().min(1) }).safeParse(input);
  if (!v.success) return { success: false, error: "Invalid connection" };
  const s = await getAuthenticatedSession();
  if (!s) return { success: false, error: "Sign in required" };
  const row = await prisma.bmadConnection.findFirst({
    where: { id: v.data.id, userId: s.userId },
  });
  if (!row) return { success: false, error: "Connection not found" };
  try {
    const key = row.encryptedKey ? decryptSecret(row.encryptedKey) : "";
    const res = await fetch(row.baseUrl + "/models", {
      headers: requestHeaders(key),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error("PROVIDER_UNAVAILABLE");
    const json = await res.json();
    const models: z.infer<typeof modelsSchema> = modelsSchema
      .parse(json.data)
      .map((m) => ({ id: m.id, name: m.name ?? m.id }));
    if (!models.length) throw new Error("NO_MODELS");
    await prisma.bmadConnection.update({
      where: { id: row.id },
      data: {
        models,
        status: key ? "authenticated" : "reachable",
        checkedAt: new Date(),
      },
    });
    revalidatePath("/connections");
    return {
      success: true,
      data: {
        models: models as ModelOption[],
        status: key ? "authenticated" : "reachable",
      },
    };
  } catch (e) {
    await prisma.bmadConnection.update({
      where: { id: row.id },
      data: { status: "unavailable", checkedAt: new Date() },
    });
    return {
      success: false,
      error: sanitizeError(e, "NETWORK_ERROR"),
      code: "CONNECTION_CHECK_FAILED",
    };
  }
}
const modelsSchema = z
  .array(z.object({ id: z.string(), name: z.string().optional() }))
  .max(10000);
export async function deleteConnection(input: {
  id: string;
}): Promise<ActionResult<{ deleted: boolean }>> {
  const v = z.object({ id: z.string().min(1) }).safeParse(input);
  if (!v.success) return { success: false, error: "Invalid connection" };
  const s = await getAuthenticatedSession();
  if (!s) return { success: false, error: "Sign in required" };
  try {
    const used = await prisma.bmadConnection.findFirst({
      where: { id: v.data.id, userId: s.userId },
      include: { _count: { select: { projects: true, agents: true } } },
    });
    if (!used) return { success: false, error: "Connection not found" };
    if (used._count.projects || used._count.agents)
      return {
        success: false,
        error: "Reassign projects and agents before removing this connection",
      };
    await prisma.bmadConnection.delete({ where: { id: used.id } });
    revalidatePath("/connections");
    return { success: true, data: { deleted: true } };
  } catch (e) {
    return { success: false, error: sanitizeError(e, "DB_ERROR") };
  }
}
export async function assignConnection(input: {
  owner: string;
  name: string;
  agentId?: string;
  connectionId: string | null;
  modelId: string | null;
}): Promise<ActionResult<{ saved: boolean }>> {
  const v = z
    .object({
      owner: z.string().min(1),
      name: z.string().min(1),
      agentId: z.string().optional(),
      connectionId: z.string().nullable(),
      modelId: z.string().nullable(),
    })
    .safeParse(input);
  if (!v.success) return { success: false, error: "Invalid model route" };
  const s = await getAuthenticatedSession();
  if (!s) return { success: false, error: "Sign in required" };
  try {
    const p = v.data;
    const repo = await prisma.repo.findFirst({
      where: { userId: s.userId, owner: p.owner, name: p.name },
    });
    if (!repo) return { success: false, error: "Project not found" };
    const runtime = await prisma.bmadProjectRuntime.upsert({
      where: { repoId: repo.id },
      create: { repoId: repo.id },
      update: {},
    });
    if (p.connectionId) {
      const c = await prisma.bmadConnection.findFirst({
        where: { id: p.connectionId, userId: s.userId },
      });
      if (!c || !p.modelId)
        return { success: false, error: "Choose a connection and model" };
      const models = c.models as ModelOption[] | null;
      if (!models?.some((m) => m.id === p.modelId))
        return {
          success: false,
          error: "Discover models before assigning this model",
        };
    }
    const data = {
      connectionId: p.connectionId,
      modelId: p.connectionId ? p.modelId : null,
      gatewayBaseUrl: null,
      gatewayModel: null,
      encryptedGatewayKey: null,
    };
    if (p.agentId) {
      const a = await prisma.bmadAgent.findFirst({
        where: { id: p.agentId, runtimeId: runtime.id },
      });
      if (!a) return { success: false, error: "Agent not found" };
      await prisma.bmadAgent.update({
        where: { id: a.id },
        data: { ...data, providerLabel: null },
      });
    } else
      await prisma.bmadProjectRuntime.update({
        where: { id: runtime.id },
        data,
      });
    revalidatePath("/repo/" + p.owner + "/" + p.name);
    return { success: true, data: { saved: true } };
  } catch (e) {
    return { success: false, error: sanitizeError(e, "DB_ERROR") };
  }
}
