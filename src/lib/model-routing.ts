import { prisma } from "./db/client";
import { decryptSecret } from "./bmad-control";
export async function getGatewayForChat(
  repoId: string,
  userId: string,
  agentId: string,
) {
  const runtime = await prisma.bmadProjectRuntime.findFirst({
    where: { repo: { id: repoId, userId } },
    include: { agents: true },
  });
  const agent = runtime?.agents.find((a) => a.id === agentId);
  if (!runtime || !agent) return null;
  const connectionId = agent.connectionId ?? runtime.connectionId;
  const connection = connectionId
    ? await prisma.bmadConnection.findFirst({
        where: { id: connectionId, userId },
      })
    : null;
  const legacyKey = agent.gatewayBaseUrl
    ? agent.encryptedGatewayKey
    : runtime.encryptedGatewayKey;
  return {
    runtime,
    agent,
    connection,
    gatewayBaseUrl:
      connection?.baseUrl ??
      agent.gatewayBaseUrl ??
      runtime.gatewayBaseUrl ??
      "http://host.docker.internal:3005/v1",
    gatewayModel: connection
      ? ((agent.connectionId ? agent.modelId : runtime.modelId) ?? "")
      : (agent.gatewayModel ?? runtime.gatewayModel ?? "gemini-3.8-flash-high"),
    providerLabel: connection?.name ?? agent.providerLabel ?? "Project default",
    apiKey: connection
      ? connection.encryptedKey
        ? decryptSecret(connection.encryptedKey)
        : ""
      : legacyKey
        ? decryptSecret(legacyKey)
        : "",
  };
}
