import { describe, it, expect } from "vitest";
import { validateGraph, migrateGraph } from "../workflow-graph";
const agents = [
  { id: "a", slug: "dev" },
  { id: "b", slug: "qa" },
];
describe("Workflow design", () => {
  it("migrates sequential IDs to stable slugs and preserves loop fields", () => {
    const g = migrateGraph(
      {
        agentIds: ["a", "b"],
        loops: [
          {
            id: "review",
            fromAgentId: "b",
            toAgentId: "a",
            trigger: "findings",
            maxIterations: 5,
            payloadType: "Defects",
          },
        ],
      },
      agents,
    );
    expect(g.nodes.map((n) => n.agentSlug)).toEqual(["dev", "qa"]);
    expect(g.edges[1]).toMatchObject({
      source: "qa",
      target: "dev",
      maxIterations: 5,
      payloadType: "Defects",
    });
  });
  it("allows feedback cycles but rejects forward cycles", () => {
    const g = migrateGraph({ agentIds: agents.map((a) => a.id) }, agents);
    expect(() =>
      validateGraph({
        ...g,
        edges: [
          ...g.edges,
          { id: "back", source: "qa", target: "dev", kind: "forward" },
        ],
      }),
    ).toThrow("cycles");
    expect(
      validateGraph({
        ...g,
        edges: [
          ...g.edges,
          {
            id: "back",
            source: "qa",
            target: "dev",
            kind: "feedback",
            trigger: "findings",
            maxIterations: 3,
          },
        ],
      }).edges,
    ).toHaveLength(2);
  });
  it("rejects unknown, duplicate and unbounded feedback connections", () => {
    const g = migrateGraph({ agentIds: agents.map((a) => a.id) }, agents);
    expect(() =>
      validateGraph({
        ...g,
        edges: [{ id: "x", source: "dev", target: "missing", kind: "forward" }],
      }),
    ).toThrow();
    expect(() =>
      validateGraph({
        ...g,
        edges: [...g.edges, { ...g.edges[0], id: "dup" }],
      }),
    ).toThrow("Duplicate");
    expect(() =>
      validateGraph({
        ...g,
        edges: [{ id: "x", source: "qa", target: "dev", kind: "feedback" }],
      }),
    ).toThrow("limit");
  });
  it("preserves parallel branches and positions on round trip", () => {
    const g = migrateGraph({ agentIds: ["a", "b", "c"] }, [
      ...agents,
      { id: "c", slug: "ux" },
    ]);
    g.edges = [
      { id: "1", source: "dev", target: "qa", kind: "forward" },
      { id: "2", source: "dev", target: "ux", kind: "forward" },
    ];
    expect(validateGraph(JSON.parse(JSON.stringify(g)))).toEqual(g);
  });
});

it("preserves missing legacy references as unavailable nodes", () => {
  const g = migrateGraph({ agentIds: ["a", "lost"] }, agents);
  expect(g.nodes[1].agentSlug).toBe("unavailable-lost");
  expect(g.edges[0].target).toBe("unavailable-lost");
});

it("starts a new workspace with an empty design", () => {
  expect(migrateGraph(null, [])).toEqual({ version: 2, nodes: [], edges: [] });
  expect(migrateGraph(null, [{ id: "a", slug: "dev" }]).nodes).toEqual([]);
});
