import "dotenv/config";
import { prisma } from "../src/lib/db/client";
import { migrateGraph } from "../src/lib/workflow-graph";
async function main() {
  const runtimes = await prisma.bmadProjectRuntime.findMany({
    include: { repo: true, agents: true },
  });
  for (const r of runtimes) {
    await prisma.$transaction(async (db) => {
      if (!r.connectionId && r.gatewayBaseUrl && r.gatewayModel) {
        const c = await db.bmadConnection.create({
          data: {
            userId: r.repo.userId,
            name: r.repo.displayName + " default",
            provider: provider(r.gatewayBaseUrl),
            baseUrl: r.gatewayBaseUrl,
            encryptedKey: r.encryptedGatewayKey,
            models: [{ id: r.gatewayModel, name: r.gatewayModel }],
            status: "unverified",
          },
        });
        await db.bmadProjectRuntime.update({
          where: { id: r.id },
          data: { connectionId: c.id, modelId: r.gatewayModel },
        });
      }
      for (const a of r.agents) {
        if (a.connectionId || !a.gatewayBaseUrl || !a.gatewayModel) continue;
        const c = await db.bmadConnection.create({
          data: {
            userId: r.repo.userId,
            name: r.repo.displayName + " · " + a.name,
            provider: provider(a.gatewayBaseUrl),
            baseUrl: a.gatewayBaseUrl,
            encryptedKey: a.encryptedGatewayKey,
            models: [{ id: a.gatewayModel, name: a.gatewayModel }],
            status: "unverified",
          },
        });
        await db.bmadAgent.update({
          where: { id: a.id },
          data: { connectionId: c.id, modelId: a.gatewayModel },
        });
      }
      if (r.workflow && !(r.workflow as { version?: number }).version) {
        const graph = migrateGraph(r.workflow, r.agents);
        await db.bmadProjectRuntime.update({
          where: { id: r.id },
          data: { workflow: graph },
        });
      }
    });
  }
  console.log(
    "Legacy routes and workflow designs migrated. Connections require verification.",
  );
}
function provider(url: string) {
  if (url.includes("openrouter.ai")) return "openrouter";
  if (url.includes("11434")) return "ollama";
  if (url.includes("1234")) return "lm-studio";
  if (url.includes("3005")) return "agy";
  if (url.includes("openai.com")) return "openai";
  if (url.includes("googleapis.com")) return "gemini";
  return "custom";
}
main().finally(() => prisma.$disconnect());
