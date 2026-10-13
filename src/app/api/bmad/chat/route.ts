import {
  boundedMessages,
  streamDelta,
  connectionStatus,
  type ConnectionEvidence,
} from "@/lib/model-adapters";
import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { getAuthenticatedSession } from "@/lib/db/helpers";
import { getGatewayForChat } from "@/lib/model-routing";
import { safeChild, decryptSecret } from "@/lib/bmad-control";
import { requestHeaders } from "@/lib/providers";
import { sseData } from "@/lib/model-stream";
import { sanitizeError } from "@/lib/errors";
const schema = z.object({
  owner: z.string().min(1),
  name: z.string().min(1),
  agentId: z.string().min(1),
  conversationId: z.string().optional(),
  message: z.string().min(1).max(16000),
  preview: z
    .object({
      connectionId: z.string(),
      modelId: z.string().min(1),
      persona: z.string().max(24000).optional(),
      skillName: z.string().optional(),
    })
    .optional(),
});
export async function POST(req: NextRequest) {
  const v = schema.safeParse(await req.json().catch(() => null));
  if (!v.success)
    return Response.json({ error: "Invalid chat request" }, { status: 400 });
  const s = await getAuthenticatedSession();
  if (!s) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const p = v.data;
    const repo = await prisma.repo.findFirst({
      where: {
        userId: s.userId,
        owner: p.owner,
        name: p.name,
        sourceType: "local",
      },
    });
    if (!repo?.localPath)
      return Response.json(
        { error: "Local project not found" },
        { status: 404 },
      );
    const route = await getGatewayForChat(repo.id, s.userId, p.agentId);
    if (!route || !route.agent.available)
      return Response.json({ error: "Agent unavailable" }, { status: 409 });
    let baseUrl = route.gatewayBaseUrl,
      model = route.gatewayModel,
      key = route.apiKey,
      provider = route.providerLabel,
      connection = route.connection;
    if (p.preview) {
      connection = await prisma.bmadConnection.findFirst({
        where: { id: p.preview.connectionId, userId: s.userId },
      });
      if (!connection)
        return Response.json(
          { error: "Connection not found" },
          { status: 404 },
        );
      baseUrl = connection.baseUrl;
      model = p.preview.modelId;
      key = connection.encryptedKey
        ? decryptSecret(connection.encryptedKey)
        : "";
      provider = connection.name;
    }
    if (!connection)
      return Response.json(
        { error: "Choose and verify a connection before testing this agent" },
        { status: 409 },
      );
    const available = connection.models as
      { id: string; contextWindow?: number }[] | null;
    if (!available?.some((m) => m.id === model))
      return Response.json(
        { error: "Discover models and choose an available model first" },
        { status: 409 },
      );
    const conversation = p.conversationId
      ? await prisma.bmadConversation.findFirst({
          where: {
            id: p.conversationId,
            runtimeId: route.runtime.id,
            agentId: p.agentId,
          },
        })
      : await prisma.bmadConversation.create({
          data: {
            runtimeId: route.runtime.id,
            agentId: p.agentId,
            title: p.message.slice(0, 72),
          },
        });
    if (!conversation)
      return Response.json(
        { error: "Conversation not found for this agent" },
        { status: 404 },
      );
    const skillName = p.preview?.skillName ?? route.agent.skillName;
    const skill = skillName
      ? await prisma.bmadSkill.findFirst({
          where: {
            runtimeId: route.runtime.id,
            name: skillName,
            source: { not: "missing" },
          },
        })
      : null;
    const skillContent = skill
      ? await fs.readFile(
          safeChild(repo.localPath, skill.directory + "/SKILL.md"),
          "utf8",
        )
      : "";
    const history = (
      await prisma.bmadMessage.findMany({
        where: { conversationId: conversation.id, status: "completed" },
        orderBy: { createdAt: "desc" },
        take: 30,
      })
    ).reverse();
    const persona =
      p.preview?.persona ??
      (typeof route.agent.persona === "string" ? route.agent.persona : "");
    const system =
      "You are " +
      route.agent.name +
      ", " +
      route.agent.title +
      ". This is a configuration test conversation. Do not run commands, write files, invoke tools, or claim to execute workflows.\nPersona: " +
      persona +
      "\nAttached skill for reference (execution unavailable):\n" +
      skillContent.slice(0, 24000);
    const userRow = await prisma.bmadMessage.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: p.message,
      },
    });
    const answerRow = await prisma.bmadMessage.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: "",
        status: "streaming",
        metadata: { provider, model, preview: !!p.preview },
      },
    });
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort("timeout"), 120000);
    req.signal.addEventListener("abort", () => abort.abort("cancelled"), {
      once: true,
    });
    const started = Date.now();
    const encoder = new TextEncoder();
    let answer = "";
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: Record<string, unknown>) => {
          try {
            controller.enqueue(
              encoder.encode("data: " + JSON.stringify(event) + "\n\n"),
            );
          } catch {
            // A disconnected client cannot receive a terminal event.
          }
        };
        let status = "completed";
        let finished = false;
        try {
          send({
            type: "metadata",
            conversationId: conversation.id,
            provider,
            model,
            preview: !!p.preview,
          });
          const upstream = await fetch(baseUrl + "/chat/completions", {
            method: "POST",
            headers: requestHeaders(key),
            signal: abort.signal,
            body: JSON.stringify({
              model,
              stream: true,
              messages: boundedMessages(
                system,
                history,
                p.message,
                available?.find((m) => m.id === model)?.contextWindow,
              ),
            }),
          });
          if (!upstream.ok || !upstream.body)
            throw new Error("PROVIDER_REQUEST_FAILED");
          for await (const data of sseData(upstream.body)) {
            if (data === "[DONE]") {
              finished = true;
              break;
            }
            const event = JSON.parse(data);
            const chunk = streamDelta(event);
            finished ||= chunk.finished;
            const delta = chunk.text;
            if (typeof delta === "string") {
              answer += delta;
              send({ type: "text", text: delta });
            }
          }
          if (!finished) throw new Error("INCOMPLETE_RESPONSE");
          if (!answer.trim()) throw new Error("EMPTY_RESPONSE");
          await prisma.bmadConnection.update({
            where: { id: connection!.id },
            data: {
              status: "tested",
              checkedAt: new Date(),
              evidence: {
                ...((connection!.evidence as object) ?? {}),
                authentication: {
                  status: key ? "verified" : "not_required",
                  checkedAt: new Date().toISOString(),
                },
                tests: {
                  ...((connection!.evidence as ConnectionEvidence)?.tests ??
                    {}),
                  [model]: {
                    status: "completed",
                    checkedAt: new Date().toISOString(),
                    latencyMs: Date.now() - started,
                  },
                },
              },
            },
          });
          send({ type: "completion", latencyMs: Date.now() - started });
        } catch (error) {
          status =
            abort.signal.aborted && abort.signal.reason !== "timeout"
              ? "cancelled"
              : "failed";
          const evidence = {
            ...((connection!.evidence as ConnectionEvidence) ?? {}),
            tests: {
              ...((connection!.evidence as ConnectionEvidence)?.tests ?? {}),
              [model]: { status, checkedAt: new Date().toISOString() },
            },
          };
          await prisma.bmadConnection.update({
            where: { id: connection!.id },
            data: { evidence, status: connectionStatus(evidence) },
          });
          send({ type: "error", error: sanitizeError(error, "NETWORK_ERROR") });
        } finally {
          clearTimeout(timeout);
          if (status !== "completed")
            await prisma.bmadMessage.update({
              where: { id: userRow.id },
              data: { status },
            });
          await prisma.bmadMessage.update({
            where: { id: answerRow.id },
            data: {
              content: answer,
              status,
              metadata: {
                provider,
                model,
                latencyMs: Date.now() - started,
                preview: !!p.preview,
              },
            },
          });
          await prisma.bmadConversation.update({
            where: { id: conversation.id },
            data: { updatedAt: new Date() },
          });
          try {
            controller.close();
          } catch {}
        }
      },
      cancel() {
        abort.abort("cancelled");
        clearTimeout(timeout);
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "x-bmad-conversation": conversation.id,
      },
    });
  } catch (error) {
    return Response.json(
      { error: sanitizeError(error, "NETWORK_ERROR") },
      { status: 500 },
    );
  }
}
