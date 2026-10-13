"use server";
import { prisma } from "@/lib/db/client";
import { getAuthenticatedSession } from "@/lib/db/helpers";
import { sanitizeError } from "@/lib/errors";
export async function getDiagnostics() {
  const session = await getAuthenticatedSession();
  if (!session) return { success: false as const, error: "Sign in required" };
  try {
    const [workers, connections, projects] = await Promise.all([
      prisma.bmadWorkerPresence.findMany({
        where: { heartbeatAt: { gt: new Date(Date.now() - 86400000) } },
        orderBy: { heartbeatAt: "desc" },
        take: 5,
      }),
      prisma.bmadConnection.findMany({
        where: { userId: session.userId },
        select: {
          id: true,
          name: true,
          provider: true,
          status: true,
          checkedAt: true,
          evidence: true,
        },
      }),
      prisma.repo.findMany({
        where: { userId: session.userId, sourceType: "local" },
        select: {
          displayName: true,
          bmadRuntime: {
            select: {
              installStatus: true,
              installedVersion: true,
              lastScannedAt: true,
              operations: {
                where: { status: { in: ["queued", "running", "failed"] } },
                select: {
                  kind: true,
                  status: true,
                  error: true,
                  updatedAt: true,
                },
                take: 10,
                orderBy: { updatedAt: "desc" },
              },
            },
          },
        },
      }),
    ]);
    return {
      success: true as const,
      data: {
        workers: workers.map((w) => ({
          online: Date.now() - w.heartbeatAt.getTime() < 45000,
          lastSeen: w.heartbeatAt,
          capabilities: w.capabilities,
        })),
        connections,
        projects,
      },
    };
  } catch (e) {
    return { success: false as const, error: sanitizeError(e, "DB_ERROR") };
  }
}
