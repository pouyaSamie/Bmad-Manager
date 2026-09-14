/**
 * Seeds the isolated Docker demo with a login and a local BMad project.
 * It is intentionally idempotent so `docker compose -f docker-compose.demo.yml up`
 * can be repeated without resetting the demo volume.
 */
import { prisma } from "../src/lib/db/client";
import { auth } from "../src/lib/auth/auth";

const demoUser = {
  email: "demo@bmadmanager.local",
  password: "demo-password-2026",
  name: "Demo Admin",
};

async function main() {
  let user = await prisma.user.findUnique({ where: { email: demoUser.email } });

  if (!user) {
    // The auth hook remains enabled for the running demo, but registration is
    // temporarily allowed here so Better Auth creates a correctly hashed password.
    process.env.ALLOW_REGISTRATION = "true";
    const result = await auth.api.signUpEmail({
      body: demoUser,
      headers: new Headers(),
    });
    process.env.ALLOW_REGISTRATION = "false";

    if (!result.user?.id) throw new Error("Could not create the demo user.");
    user = await prisma.user.findUniqueOrThrow({ where: { id: result.user.id } });
  }

  user = await prisma.user.update({
    where: { id: user.id },
    data: { role: "admin" },
  });

  const repo = await prisma.repo.upsert({
    where: { userId_owner_name: { userId: user.id, owner: "local", name: "atlas-platform" } },
    create: {
      userId: user.id,
      owner: "local",
      name: "atlas-platform",
      branch: "main",
      displayName: "Atlas Platform",
      description: "A seeded local BMad project for exploring the dashboard.",
      sourceType: "local",
      localPath: "/demo/atlas-platform",
      totalFiles: 8,
      lastSyncedAt: new Date(),
    },
    update: {
      displayName: "Atlas Platform",
      description: "A seeded local BMad project for exploring the dashboard.",
      localPath: "/demo/atlas-platform",
      totalFiles: 8,
      lastSyncedAt: new Date(),
    },
  });

  const runtime = await prisma.bmadProjectRuntime.upsert({
    where: { repoId: repo.id },
    create: {
      repoId: repo.id,
      installStatus: "ready",
      installedVersion: "6.0.0-demo",
      lastScannedAt: new Date(),
      modules: ["planning", "implementation"],
      tools: ["project-status", "create-story", "review-story"],
      workflow: ["discovery", "planning", "implementation", "review"],
    },
    update: {
      installStatus: "ready",
      installedVersion: "6.0.0-demo",
      lastScannedAt: new Date(),
    },
  });

  await prisma.bmadAgent.upsert({
    where: { runtimeId_slug: { runtimeId: runtime.id, slug: "product-planner" } },
    create: {
      runtimeId: runtime.id,
      slug: "product-planner",
      skillName: "planning",
      name: "Maya",
      title: "Product Planner",
      icon: "🧭",
      description: "Turns discovery notes into scoped, reviewable plans.",
    },
    update: {},
  });
  await prisma.bmadAgent.upsert({
    where: { runtimeId_slug: { runtimeId: runtime.id, slug: "delivery-engineer" } },
    create: {
      runtimeId: runtime.id,
      slug: "delivery-engineer",
      skillName: "implementation",
      name: "Noah",
      title: "Delivery Engineer",
      icon: "⚡",
      description: "Guides implementation and prepares reviewable changes.",
    },
    update: {},
  });

  console.log(`Demo ready for ${demoUser.email} (password: ${demoUser.password}).`);
}

main()
  .catch((error) => {
    console.error("Demo seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
