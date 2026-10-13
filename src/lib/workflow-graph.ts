import { z } from "zod";
export const graphSchema = z.object({
  version: z.literal(2),
  nodes: z
    .array(
      z.object({
        id: z.string().min(1),
        agentSlug: z.string().min(1),
        position: z.object({ x: z.number().finite(), y: z.number().finite() }),
      }),
    )
    .max(50),
  edges: z
    .array(
      z.object({
        id: z.string().min(1),
        source: z.string(),
        target: z.string(),
        kind: z.enum(["forward", "feedback"]),
        trigger: z
          .enum(["verdicts", "findings", "needs_revision", "custom"])
          .optional(),
        description: z.string().max(2000).optional(),
        payloadType: z.string().max(500).optional(),
        maxIterations: z.number().int().min(1).max(20).optional(),
      }),
    )
    .max(200),
});
export type WorkflowGraph = z.infer<typeof graphSchema>;
export function validateGraph(input: unknown): WorkflowGraph {
  const graph = graphSchema.parse(input);
  const ids = new Set(graph.nodes.map((n) => n.id));
  if (ids.size !== graph.nodes.length)
    throw new Error("Node IDs must be unique");
  if (new Set(graph.edges.map((e) => e.id)).size !== graph.edges.length)
    throw new Error("Connection IDs must be unique");
  const pairs = new Set<string>();
  for (const e of graph.edges) {
    if (!ids.has(e.source) || !ids.has(e.target) || e.source === e.target)
      throw new Error("Connections must join different existing nodes");
    const key = [e.source, e.target, e.kind, e.trigger ?? ""].join(":");
    if (pairs.has(key)) throw new Error("Duplicate connection");
    pairs.add(key);
    if (e.kind === "feedback" && (!e.trigger || !e.maxIterations))
      throw new Error("Feedback requires a trigger and iteration limit");
  }
  const visiting = new Set<string>(),
    done = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id))
      throw new Error("Forward connections cannot contain cycles");
    if (done.has(id)) return;
    visiting.add(id);
    for (const e of graph.edges.filter(
      (e) => e.kind === "forward" && e.source === id,
    ))
      visit(e.target);
    visiting.delete(id);
    done.add(id);
  }
  graph.nodes.forEach((n) => visit(n.id));
  return graph;
}
export function migrateGraph(
  input: unknown,
  agents: { id: string; slug: string }[],
): WorkflowGraph {
  if (input && typeof input === "object" && "version" in input)
    return validateGraph(input);
  const old = input as {
    agentIds?: string[];
    loops?: {
      id: string;
      fromAgentId: string;
      toAgentId: string;
      trigger: string;
      description?: string;
      maxIterations?: number;
      payloadType?: string;
    }[];
  } | null;
  const ordered = (old?.agentIds ?? agents.map((a) => a.id)).map(
    (id) =>
      agents.find((a) => a.id === id) ?? { id, slug: "unavailable-" + id },
  );
  const nodes = ordered.map((a, i) => ({
    id: a.slug,
    agentSlug: a.slug,
    position: { x: (i % 4) * 280, y: Math.floor(i / 4) * 220 },
  }));
  const lookup = new Map(ordered.map((a) => [a.id, a.slug]));
  const edges: WorkflowGraph["edges"] = nodes.slice(1).map((n, i) => ({
    id: "forward-" + i,
    source: nodes[i].id,
    target: n.id,
    kind: "forward",
  }));
  for (const l of old?.loops ?? []) {
    const source = lookup.get(l.fromAgentId),
      target = lookup.get(l.toAgentId);
    if (source && target && source !== target)
      edges.push({
        id: l.id,
        source,
        target,
        kind: "feedback",
        trigger: ["verdicts", "findings", "needs_revision", "custom"].includes(
          l.trigger,
        )
          ? (l.trigger as "verdicts")
          : "custom",
        description: l.description,
        maxIterations: l.maxIterations ?? 3,
        payloadType: l.payloadType,
      });
  }
  return validateGraph({ version: 2, nodes, edges });
}

export function managerPreset(
  agents: {
    id: string;
    slug: string;
    name?: string;
    skillName?: string | null;
  }[],
): WorkflowGraph {
  const roles = [
    "analyst",
    "pm",
    "ux-designer",
    "architect",
    "dev",
    "tea",
    "po",
  ];
  const ordered = roles.map((role) =>
    agents.find(
      (a) =>
        (a.skillName ?? a.slug) ===
        (role === "tea" ? "bmad-tea" : "bmad-agent-" + role),
    ),
  );
  if (ordered.some((a) => !a))
    throw new Error(
      "The Manager preset requires Mary, John, Sally, Winston, Amelia, Murat, and Nella. Add missing agents first.",
    );
  const positions = [
    { x: 0, y: 220 },
    { x: 300, y: 0 },
    { x: 300, y: 220 },
    { x: 600, y: 0 },
    { x: 900, y: 0 },
    { x: 900, y: 220 },
    { x: 1200, y: 0 },
  ];
  const nodes = ordered.map((a, i) => ({
    id: a!.slug,
    agentSlug: a!.slug,
    position: positions[i],
  }));
  const pairs = [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
  ];
  const edges: WorkflowGraph["edges"] = pairs.map(([from, to], i) => ({
    id: "handoff-" + i,
    source: nodes[from].id,
    target: nodes[to].id,
    kind: "forward",
  }));
  edges.push(
    {
      id: "qa-feedback",
      source: nodes[5].id,
      target: nodes[4].id,
      kind: "feedback",
      trigger: "findings",
      maxIterations: 5,
      description: "QA findings return to development",
      payloadType: "Defect reports and failing tests",
    },
    {
      id: "po-feedback",
      source: nodes[6].id,
      target: nodes[1].id,
      kind: "feedback",
      trigger: "verdicts",
      maxIterations: 3,
      description: "End-user critique returns to the product manager",
      payloadType: "PO verdict and usability findings",
    },
  );
  return validateGraph({ version: 2, nodes, edges });
}
