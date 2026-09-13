import { NextRequest } from "next/server";
import { z } from "zod";
import fs from "node:fs/promises";
import { prisma } from "@/lib/db/client";
import { getAuthenticatedSession } from "@/lib/db/helpers";
import { getGatewayForChat } from "@/actions/bmad-control-actions";
import { safeChild } from "@/lib/bmad-control";

const requestSchema = z.object({ owner: z.string().min(1), name: z.string().min(1), agentId: z.string().min(1), conversationId: z.string().optional(), message: z.string().min(1).max(16000) });

function textDelta(line: string): string {
  if (!line.startsWith("data: ") || line === "data: [DONE]") return "";
  try { return JSON.parse(line.slice(6)).choices?.[0]?.delta?.content ?? ""; } catch { return ""; }
}

export async function POST(request: NextRequest) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid chat request" }, { status: 400 });
  const session = await getAuthenticatedSession();
  if (!session) return Response.json({ error: "Not authenticated" }, { status: 401 });
  const repo = await prisma.repo.findFirst({ where: { userId: session.userId, owner: parsed.data.owner, name: parsed.data.name, sourceType: "local" }, select: { id: true, localPath: true } });
  if (!repo?.localPath) return Response.json({ error: "Local project not found" }, { status: 404 });
  const gateway = await getGatewayForChat(repo.id, session.userId);
  if (!gateway) return Response.json({ error: "Configure a gateway API key and model before chatting" }, { status: 409 });
  const agent = gateway.runtime.agents.find((item) => item.id === parsed.data.agentId);
  if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 });
  const conversation = parsed.data.conversationId
    ? await prisma.bmadConversation.findFirst({ where: { id: parsed.data.conversationId, runtimeId: gateway.runtime.id } })
    : await prisma.bmadConversation.create({ data: { runtimeId: gateway.runtime.id, agentId: agent.id, title: parsed.data.message.slice(0, 72) } });
  if (!conversation) return Response.json({ error: "Conversation not found" }, { status: 404 });
  await prisma.bmadMessage.create({ data: { conversationId: conversation.id, role: "user", content: parsed.data.message } });
  const skill = agent.skillName ? await prisma.bmadSkill.findFirst({ where: { runtimeId: gateway.runtime.id, name: agent.skillName } }) : null;
  const skillContent = skill ? await fs.readFile(safeChild(repo.localPath, `${skill.directory}/SKILL.md`), "utf8").catch(() => "") : "";
  const history = await prisma.bmadMessage.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" }, take: 40 });
  const system = `You are ${agent.name}, ${agent.title}. ${agent.description ?? ""}\n\nConfigured persona:\n${typeof agent.persona === "string" ? agent.persona : "No additional project persona override."}\n\nAttached skill:\n${skillContent.slice(0, 24000)}\n\nYou are inside MyBMAD. You may inspect and explain BMad configuration, but you cannot write files or run commands. When a change is needed, describe the exact approved operation the user should draft. Keep the configured persona.`;
  const endpoint = `${gateway.runtime.gatewayBaseUrl!.replace(/\/$/, "")}/chat/completions`;
  const upstream = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${gateway.apiKey}` }, body: JSON.stringify({ model: gateway.runtime.gatewayModel, stream: true, messages: [{ role: "system", content: system }, ...history.map((item) => ({ role: item.role === "assistant" ? "assistant" : "user", content: item.content }))] }) });
  if (!upstream.ok || !upstream.body) return Response.json({ error: "Gateway request failed" }, { status: 502 });
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let answer = "";
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const raw = decoder.decode(value, { stream: true });
          for (const line of raw.split("\n")) answer += textDelta(line);
          controller.enqueue(value);
        }
        await prisma.bmadMessage.create({ data: { conversationId: conversation.id, role: "assistant", content: answer || "No text response received." } });
        await prisma.bmadConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
      } finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache", "x-bmad-conversation": conversation.id } });
}