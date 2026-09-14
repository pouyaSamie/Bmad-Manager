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

  // Seed the full BMad delivery loop rather than a placeholder pipeline. The
  // same agent order and review loops are used by BMad Control as its default.
  await prisma.bmadAgent.deleteMany({
    where: {
      runtimeId: runtime.id,
      slug: { in: ["product-planner", "delivery-engineer"] },
    },
  });
  const agentDefinitions = [
    ["bmad-agent-analyst", "analysis", "Mary", "Business Analyst", "🔎", "Frames the problem, research, and discovery findings."],
    ["bmad-agent-pm", "planning", "John", "Product Manager", "🧭", "Turns discovery into a prioritized, reviewable delivery plan."],
    ["bmad-agent-ux-designer", "ux-design", "Sally", "UX Designer", "🎨", "Shapes the experience and validates the user journey."],
    ["bmad-agent-architect", "architecture", "architecture", "Solution Architect", "🏗️", "Defines the technical approach and delivery guardrails."],
    ["bmad-agent-dev", "implementation", "Amelia", "Developer", "⚡", "Implements approved stories and prepares work for review."],
    ["bmad-tea", "quality", "Murat", "Test Engineer", "🧪", "Tests delivery outcomes and reports actionable findings."],
    ["bmad-agent-po", "product-ownership", "Nella", "Product Owner & Critic", "👑", "Reviews outcomes against acceptance criteria and delivery intent."],
  ] as const;
  const agents = await Promise.all(agentDefinitions.map(async ([slug, skillName, name, title, icon, description]) =>
    prisma.bmadAgent.upsert({
      where: { runtimeId_slug: { runtimeId: runtime.id, slug } },
      create: { runtimeId: runtime.id, slug, skillName, name, title, icon, description },
      update: { skillName, name, title, icon, description },
    })
  ));
  const agentBySlug = new Map(agents.map((agent) => [agent.slug, agent]));
  const john = agentBySlug.get("bmad-agent-pm")!;
  const murat = agentBySlug.get("bmad-tea")!;
  const nella = agentBySlug.get("bmad-agent-po")!;
  await prisma.bmadProjectRuntime.update({
    where: { id: runtime.id },
    data: {
      workflow: {
        agentIds: agents.map((agent) => agent.id),
        loops: [
          {
            id: `${nella.id}->${john.id}:verdicts`,
            fromAgentId: nella.id,
            toAgentId: john.id,
            trigger: "verdicts",
            description: "Route PO verdicts and unmet acceptance criteria back to planning for another delivery pass.",
          },
          {
            id: `${murat.id}->${john.id}:findings`,
            fromAgentId: murat.id,
            toAgentId: john.id,
            trigger: "findings",
            description: "Route test findings and quality defects back to planning for triage and story refinement.",
          },
        ],
      },
    },
  });

  console.log(`Demo ready for ${demoUser.email} (password: ${demoUser.password}).`);
}

main()
  .catch((error) => {
    console.error("Demo seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
