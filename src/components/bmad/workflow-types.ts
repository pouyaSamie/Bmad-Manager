/* eslint-disable @typescript-eslint/no-explicit-any */

export type WorkflowLoop = {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  trigger: "verdicts" | "findings" | "needs_revision" | "custom";
  description?: string;
  maxIterations?: number;
  payloadType?: string;
};

export type AgentRoleMeta = {
  role: string;
  phase: string;
  phaseIndex: number;
  color: string;
  border: string;
  bg: string;
  badge: string;
  icon: string;
  accent: string;
  inputContract: string;
  outputContract: string;
  defaultTools: string[];
  defaultModel: string;
  defaultPersona: string;
};

export const ROLE_META_MAP: Record<string, AgentRoleMeta> = {
  mary: {
    role: "Business Analyst",
    phase: "1. Discovery & Needs",
    phaseIndex: 1,
    color: "text-sky-500",
    border: "border-sky-500/40",
    bg: "bg-sky-500/5",
    badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    icon: "🔍",
    accent: "bg-sky-500",
    inputContract: "Project Brief, Domain Context",
    outputContract: "PRD (Product Requirements Document)",
    defaultTools: ["Docs Generator", "Requirements Parser"],
    defaultModel: "gemini-3.8-flash-high",
    defaultPersona:
      "You are Mary, the lead Business Analyst. Your mission is to uncover core business needs, elicit precise requirements from user briefs and domain context, identify user personas and problem statements, and produce structured, actionable PRD artifacts in _bmad-output/planning-artifacts/. You focus on user value, eliminate ambiguities, and ensure clear scope.",
  },
  john: {
    role: "Product Manager",
    phase: "2. Definition & Epics",
    phaseIndex: 2,
    color: "text-blue-500",
    border: "border-blue-500/40",
    bg: "bg-blue-500/5",
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    icon: "📋",
    accent: "bg-blue-500",
    inputContract: "PRD, Stakeholder Feedback",
    outputContract: "Epics, Stories, Gherkin Criteria",
    defaultTools: ["Story Breakdown", "Backlog Manager"],
    defaultModel: "gemini-3.8-flash-high",
    defaultPersona:
      "You are John, the Product Manager. You translate PRDs and user requirements into prioritized epics and granular user stories with clear Gherkin acceptance criteria (Given/When/Then). You own sprint boundaries, manage dependencies, and ensure the engineering team has crystal-clear execution tracks.",
  },
  sally: {
    role: "UX Designer",
    phase: "2. Definition & Epics",
    phaseIndex: 2,
    color: "text-purple-500",
    border: "border-purple-500/40",
    bg: "bg-purple-500/5",
    badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    icon: "🎨",
    accent: "bg-purple-500",
    inputContract: "PRD, Stories, User Personas",
    outputContract: "UI Specs, Component Tokens",
    defaultTools: ["Tailwind Theme", "Component Specs"],
    defaultModel: "gemini-3.8-flash-high",
    defaultPersona:
      "You are Sally, the UX & Interaction Designer. You craft intuitive, accessible, and delight-driven user experiences. You design interaction flows, wireframes, component design tokens, and verify that layouts respect Tailwind conventions and ergonomic usability standards.",
  },
  winston: {
    role: "System Architect",
    phase: "3. System Architecture",
    phaseIndex: 3,
    color: "text-amber-500",
    border: "border-amber-500/40",
    bg: "bg-amber-500/5",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    icon: "🏗️",
    accent: "bg-amber-500",
    inputContract: "Stories, Tech Stack Constraints",
    outputContract: "architecture.md, Schema, APIs",
    defaultTools: ["Prisma Schema", "Architecture Linter"],
    defaultModel: "gemini-3.8-flash-high",
    defaultPersona:
      "You are Winston, the System Architect. You design robust, scalable technical architectures, database schemas (Prisma), API specifications, and directory conventions. You ensure high security, data integrity, path safety, and zero technical debt across the codebase.",
  },
  amelia: {
    role: "Senior Software Engineer",
    phase: "4. Dev & QA Loop",
    phaseIndex: 4,
    color: "text-emerald-500",
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/5",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    icon: "💻",
    accent: "bg-emerald-500",
    inputContract: "User Story, Architecture Specs",
    outputContract: "Code, Git Branch, Pull Request",
    defaultTools: ["Filesystem", "Git Engine", "Terminal"],
    defaultModel: "gemini-3.8-flash-high",
    defaultPersona:
      "You are Amelia, the Senior Software Engineer. You implement clean, modular, fully typed, production-ready code. You write deterministic unit tests, follow project design systems, adhere strictly to security standards, and prepare high-quality pull requests with zero lint warnings.",
  },
  murat: {
    role: "Test Architect & QA",
    phase: "4. Dev & QA Loop",
    phaseIndex: 4,
    color: "text-cyan-500",
    border: "border-cyan-500/40",
    bg: "bg-cyan-500/5",
    badge: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    icon: "🧪",
    accent: "bg-cyan-500",
    inputContract: "Code Implementation, PR",
    outputContract: "Vitest Traces, Defect Report",
    defaultTools: ["Vitest Runner", "Playwright E2E"],
    defaultModel: "gemini-3.8-flash-high",
    defaultPersona:
      "You are Murat, the Master Test Architect & QA Advisor. You construct rigorous automated test suites (Vitest, Playwright), uncover edge cases, test error boundaries, and catch defects before release. If code fails verification, you trigger defect findings with reproduction steps back to the implementation loop.",
  },
  nella: {
    role: "Product Owner & Critic",
    phase: "5. PO Acceptance Gate",
    phaseIndex: 5,
    color: "text-rose-500",
    border: "border-rose-500/40",
    bg: "bg-rose-500/5",
    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    icon: "👑",
    accent: "bg-rose-500",
    inputContract: "Sprint Delivery, Stories, Code",
    outputContract: "PO Verdict, Quality Score (>= 9.0)",
    defaultTools: ["Acceptance Verifier", "UI Inspector"],
    defaultModel: "gemini-3.8-flash-high",
    defaultPersona:
      "You are Nella, the Product Owner and Principal UX Critic. Crucially, you do not simply review code or static markup from a developer's perspective: you put yourself directly into the shoes of a real end-user trying to use this product. You test and evaluate user journeys, ergonomic friction, intuitive UI/UX workflows, clarity of feedback, and real-world usability. If a user would feel confused, lost, or frustrated, you issue a critique verdict requiring revision before shipping.",
  },
};

export function getAgentMeta(agent: any): AgentRoleMeta {
  const nameKey = agent?.name?.toLowerCase() || "";
  const slugKey = agent?.slug?.toLowerCase() || "";
  for (const [key, meta] of Object.entries(ROLE_META_MAP)) {
    if (nameKey.includes(key) || slugKey.includes(key)) {
      return meta;
    }
  }
  return {
    role: agent?.title || "Agent",
    phase: "Delivery Pipeline",
    phaseIndex: 9,
    color: "text-muted-foreground",
    border: "border-border",
    bg: "bg-card",
    badge: "bg-muted text-muted-foreground border-border",
    icon: agent?.icon || "🤖",
    accent: "bg-primary",
    inputContract: "Previous Stage Output",
    outputContract: "Artifact Deliverable",
    defaultTools: ["Standard Shell", "Filesystem"],
    defaultModel: "gemini-3.8-flash-high",
    defaultPersona:
      "You are an autonomous AI Agent contributing to the BMad delivery cycle. Deliver production-grade outcomes adhering to project conventions and quality criteria.",
  };
}
