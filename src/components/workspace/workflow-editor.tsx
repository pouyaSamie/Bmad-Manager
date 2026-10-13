"use client";
import { useUnsavedChanges } from "./use-unsaved-changes";
import { useState, useMemo } from "react";
import { useMediaQuery } from "@mantine/hooks";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  type EdgeProps,
  type Node,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import {
  Stack,
  Group,
  Button,
  Select,
  Text,
  Paper,
  Title,
  Alert,
  Modal,
  Textarea,
  SegmentedControl,
  NumberInput,
  TextInput,
  useComputedColorScheme,
} from "@mantine/core";
import { draftBmadOperation } from "@/actions/bmad-control-actions";
import {
  migrateGraph,
  managerPreset,
  validateGraph,
  type WorkflowGraph,
} from "@/lib/workflow-graph";
import type { Agent, StudioData } from "./studio-types";
function FeedbackEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  markerEnd,
}: EdgeProps) {
  const { getNodes } = useReactFlow();
  const nodes = getNodes();
  const isQa = data?.trigger === "findings";
  const extreme = isQa
    ? Math.max(
        480,
        ...nodes.map((n) => n.position.y + (n.measured?.height ?? 140)),
      ) + 80
    : Math.min(-40, ...nodes.map((n) => n.position.y)) - 80;
  const edgePath =
    "M " +
    sourceX +
    " " +
    sourceY +
    " C " +
    (sourceX + 60) +
    " " +
    extreme +
    ", " +
    (targetX - 60) +
    " " +
    extreme +
    ", " +
    targetX +
    " " +
    targetY;
  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: isQa
            ? "var(--mantine-color-orange-6)"
            : "var(--mantine-color-indigo-6)",
          strokeWidth: 2,
          strokeDasharray: "7 5",
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: "absolute",
            transform:
              "translate(-50%, -50%) translate(" +
              (sourceX + targetX) / 2 +
              "px, " +
              extreme +
              "px)",
            background: "var(--card)",
            padding: "4px 8px",
            fontSize: 12,
            borderRadius: 6,
          }}
        >
          {String(data?.trigger ?? "feedback")} ·{" "}
          {String(data?.maxIterations ?? 3)} iterations
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
const edgeTypes = { feedback: FeedbackEdge };
export function WorkflowEditor(props: {
  data: StudioData;
  owner: string;
  name: string;
  onInspect: (a: Agent) => void;
  connections: { id: string; name: string }[];
  onRefresh: () => Promise<void>;
}) {
  return (
    <ReactFlowProvider>
      <Editor {...props} />
    </ReactFlowProvider>
  );
}
function Editor({
  data,
  owner,
  name,
  onInspect,
  connections,
  onRefresh,
}: {
  data: StudioData;
  owner: string;
  name: string;
  onInspect: (a: Agent) => void;
  connections: { id: string; name: string }[];
  onRefresh: () => Promise<void>;
}) {
  const [graph, setGraph] = useState<WorkflowGraph>(() =>
      migrateGraph(data.runtime.workflow, data.agents),
    ),
    [view, setView] = useState<string | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [source, setSource] = useState<string | null>(null),
    [target, setTarget] = useState<string | null>(null),
    [kind, setKind] = useState<"forward" | "feedback">("forward"),
    [trigger, setTrigger] = useState("verdicts"),
    [limit, setLimit] = useState<number | string>(3),
    [description, setDescription] = useState(""),
    [payloadType, setPayload] = useState(""),
    [edgeId, setEdgeId] = useState<string | null>(null),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [past, setPast] = useState<WorkflowGraph[]>([]),
    [future, setFuture] = useState<WorkflowGraph[]>([]);
  const [savedGraph, setSavedGraph] = useState(JSON.stringify(graph));
  const dirty = JSON.stringify(graph) !== savedGraph;
  useUnsavedChanges(dirty);
  const flow = useReactFlow();
  const mobile = useMediaQuery("(max-width:48em)");
  const activeView = view ?? (mobile ? "list" : "canvas");
  const colorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });
  function commit(next: WorkflowGraph) {
    try {
      validateGraph(next);
      setPast((p) => [...p, graph].slice(-60));
      setFuture([]);
      setGraph(next);
      setError("");
      setNotice("Unsaved design");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid graph");
    }
  }
  const nodes: Node[] = useMemo(
    () =>
      graph.nodes.map((n) => {
        const a = data.agents.find((a) => a.slug === n.agentSlug);
        return {
          id: n.id,
          position: n.position,
          width: 220,
          height: 150,
          measured: { width: 220, height: 150 },
          sourcePosition: "right" as Node["sourcePosition"],
          targetPosition: "left" as Node["targetPosition"],
          data: {
            label: (
              <Stack gap={6}>
                <Text fw={650}>
                  {a?.icon} {a?.name ?? n.agentSlug}
                </Text>
                <Text size="xs" c="dimmed">
                  {a?.title ?? "Unavailable agent"}
                </Text>
                <Text size="xs" style={{ overflowWrap: "anywhere" }}>
                  {(() => {
                    const connection = connections.find(
                      (c) =>
                        c.id === (a?.connectionId ?? data.runtime.connectionId),
                    );
                    return connection
                      ? connection.name +
                          " · " +
                          (a?.connectionId ? a.modelId : data.runtime.modelId)
                      : "Choose a model";
                  })()}
                </Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => a && onInspect(a)}
                >
                  Configure
                </Button>
              </Stack>
            ),
          },
        };
      }),
    [graph.nodes, data.agents, data.runtime, connections, onInspect],
  );
  const edges = graph.edges.map((e) => ({
    ...e,
    type: e.kind === "feedback" ? "feedback" : "smoothstep",
    label: e.kind === "forward" ? e.description : undefined,
    data: e,
    animated: false,
  }));
  function layout() {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "LR", ranksep: 100, nodesep: 70 });
    g.setDefaultEdgeLabel(() => ({}));
    graph.nodes.forEach((n) => g.setNode(n.id, { width: 220, height: 150 }));
    graph.edges
      .filter((e) => e.kind === "forward")
      .forEach((e) => g.setEdge(e.source, e.target));
    dagre.layout(g);
    commit({
      ...graph,
      nodes: graph.nodes.map((n) => ({
        ...n,
        position: { x: g.node(n.id).x - 110, y: g.node(n.id).y - 75 },
      })),
    });
    setTimeout(() => flow.fitView({ padding: 0.25 }), 0);
  }
  function edit(id?: string) {
    const e = graph.edges.find((e) => e.id === id);
    setEdgeId(e?.id ?? null);
    setSource(e?.source ?? null);
    setTarget(e?.target ?? null);
    setKind(e?.kind ?? "forward");
    setTrigger(e?.trigger ?? "verdicts");
    setLimit(e?.maxIterations ?? 3);
    setDescription(e?.description ?? "");
    setPayload(e?.payloadType ?? "");
    setOpen(true);
  }
  function addEdge() {
    if (!source || !target) return;
    const e = {
      id: edgeId ?? crypto.randomUUID(),
      source,
      target,
      kind,
      description,
      payloadType,
      ...(kind === "feedback"
        ? { trigger: trigger as "verdicts", maxIterations: Number(limit) }
        : {}),
    };
    try {
      const next = validateGraph({
        ...graph,
        edges: [...graph.edges.filter((e) => e.id !== edgeId), e],
      });
      commit(next);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid connection");
    }
  }
  const choices = graph.nodes.map((n) => ({
    value: n.id,
    label: data.agents.find((a) => a.slug === n.agentSlug)?.name ?? n.agentSlug,
  }));
  return (
    <Stack>
      {!graph.nodes.length && (
        <Alert color="indigo">
          Start with an empty design, add an agent, or choose the Manager
          preset. No handoffs are created automatically.
        </Alert>
      )}
      <Group justify="space-between">
        <div>
          <Title order={1}>Workflow</Title>
          <Text c="dimmed">
            Design handoffs and feedback. Execution is deferred.
          </Text>
        </div>
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const r = await draftBmadOperation({
              owner,
              name,
              kind: "set_workflow",
              payload: { graph },
            });
            setBusy(false);
            if (!r.success) setError(r.error);
            else {
              setSavedGraph(JSON.stringify(graph));
              setNotice("Design drafted. Review it in Project Settings.");
              await onRefresh();
            }
          }}
        >
          Draft workflow change
        </Button>
      </Group>
      {error && <Alert color="red">{error}</Alert>}
      {notice && <Alert color="indigo">{notice}</Alert>}
      <Group>
        <Select
          searchable
          placeholder="Add an agent"
          aria-label="Agent palette"
          data={data.agents
            .filter((a) => a.available)
            .map((a) => ({ value: a.slug, label: a.name + " · " + a.title }))}
          value={selected}
          onChange={setSelected}
          style={{ flex: "1 1 220px" }}
        />
        <Button
          variant="light"
          disabled={!selected}
          onClick={() => {
            if (selected)
              commit({
                ...graph,
                nodes: [
                  ...graph.nodes,
                  {
                    id: crypto.randomUUID(),
                    agentSlug: selected,
                    position: {
                      x: graph.nodes.length * 60,
                      y: graph.nodes.length * 40,
                    },
                  },
                ],
              });
            setSelected(null);
          }}
        >
          Add agent
        </Button>
        <Button variant="light" onClick={() => edit()}>
          Add connection
        </Button>
        <Button
          variant="default"
          onClick={() => {
            try {
              commit(managerPreset(data.agents));
            } catch (e) {
              setError(e instanceof Error ? e.message : "Preset unavailable");
            }
          }}
        >
          Manager 7-agent preset
        </Button>
        <Button variant="default" onClick={layout}>
          Auto layout
        </Button>
        <Button
          variant="default"
          onClick={() => flow.fitView({ padding: 0.25 })}
        >
          Fit view
        </Button>
        <Button
          variant="subtle"
          disabled={!past.length}
          onClick={() => {
            const prev = past.at(-1);
            if (prev) {
              setPast((p) => p.slice(0, -1));
              setFuture((f) => [...f, graph]);
              setGraph(prev);
            }
          }}
        >
          Undo
        </Button>
        <Button
          variant="subtle"
          disabled={!future.length}
          onClick={() => {
            const next = future.at(-1);
            if (next) {
              setFuture((f) => f.slice(0, -1));
              setPast((p) => [...p, graph].slice(-60));
              setGraph(next);
            }
          }}
        >
          Redo
        </Button>
        <SegmentedControl
          value={activeView}
          onChange={setView}
          data={[
            { value: "canvas", label: "Canvas" },
            { value: "list", label: "List" },
          ]}
        />
      </Group>
      {activeView === "canvas" ? (
        <div className="workflow-surface">
          <ReactFlow
            colorMode={colorScheme}
            nodes={nodes}
            edges={edges}
            edgeTypes={edgeTypes}
            minZoom={0.5}
            maxZoom={1.8}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            onNodeDoubleClick={(_, n) => {
              const a = data.agents.find(
                (a) =>
                  a.slug === graph.nodes.find((x) => x.id === n.id)?.agentSlug,
              );
              if (a) onInspect(a);
            }}
            onNodesChange={(changes) => {
              if (
                changes.every(
                  (c) => c.type === "dimensions" || c.type === "select",
                )
              )
                return;
              const updated = applyNodeChanges(changes, nodes);
              setGraph((g) => ({
                ...g,
                nodes: updated.map((n) => ({
                  id: n.id,
                  agentSlug: g.nodes.find((x) => x.id === n.id)!.agentSlug,
                  position: n.position,
                })),
                edges: g.edges.filter(
                  (e) =>
                    updated.some((n) => n.id === e.source) &&
                    updated.some((n) => n.id === e.target),
                ),
              }));
            }}
            onNodeDragStart={() => {
              setPast((p) => [...p, graph].slice(-60));
              setFuture([]);
            }}
            onConnect={(c) => {
              if (c.source && c.target)
                commit({
                  ...graph,
                  edges: [
                    ...graph.edges,
                    {
                      id: crypto.randomUUID(),
                      source: c.source,
                      target: c.target,
                      kind: "forward",
                    },
                  ],
                });
            }}
            onEdgeDoubleClick={(_, e) => edit(e.id)}
            onEdgesDelete={(removed) =>
              commit({
                ...graph,
                edges: graph.edges.filter(
                  (e) => !removed.some((r) => r.id === e.id),
                ),
              })
            }
          >
            <Background gap={24} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
      ) : (
        <Stack>
          {graph.nodes.map((n) => {
            const a = data.agents.find((a) => a.slug === n.agentSlug);
            return (
              <Paper withBorder p="md" key={n.id}>
                <Group justify="space-between">
                  <div>
                    <Text fw={600}>{a?.name ?? n.agentSlug}</Text>
                    <Text c="dimmed" size="sm">
                      {a?.title}
                    </Text>
                  </div>
                  <Group>
                    <Button variant="light" onClick={() => a && onInspect(a)}>
                      Configure
                    </Button>
                    <Button
                      color="red"
                      variant="subtle"
                      onClick={() =>
                        commit({
                          ...graph,
                          nodes: graph.nodes.filter((x) => x.id !== n.id),
                          edges: graph.edges.filter(
                            (e) => e.source !== n.id && e.target !== n.id,
                          ),
                        })
                      }
                    >
                      Remove
                    </Button>
                  </Group>
                </Group>
              </Paper>
            );
          })}
        </Stack>
      )}
      <Title order={3}>Connections · {graph.edges.length}</Title>
      <Stack>
        {graph.edges.map((e) => (
          <Paper withBorder p="md" key={e.id}>
            <Group justify="space-between">
              <div>
                <Text>
                  {choices.find((c) => c.value === e.source)?.label} →{" "}
                  {choices.find((c) => c.value === e.target)?.label}
                </Text>
                <Text c="dimmed" size="sm">
                  {e.kind === "feedback"
                    ? e.trigger + " · " + e.maxIterations + " iterations"
                    : "Forward handoff"}
                  {e.description ? " · " + e.description : ""}
                </Text>
              </div>
              <Group>
                <Button variant="light" size="sm" onClick={() => edit(e.id)}>
                  Edit
                </Button>
                <Button
                  variant="subtle"
                  size="sm"
                  color="red"
                  onClick={() =>
                    commit({
                      ...graph,
                      edges: graph.edges.filter((x) => x.id !== e.id),
                    })
                  }
                >
                  Remove
                </Button>
              </Group>
            </Group>
          </Paper>
        ))}
      </Stack>
      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title={edgeId ? "Edit connection" : "Add connection"}
      >
        <Stack>
          <Select
            label="From agent"
            data={choices}
            value={source}
            onChange={setSource}
          />
          <Select
            label="To agent"
            data={choices.filter((c) => c.value !== source)}
            value={target}
            onChange={setTarget}
          />
          <Select
            label="Connection type"
            value={kind}
            data={[
              { value: "forward", label: "Forward handoff" },
              { value: "feedback", label: "Feedback loop" },
            ]}
            onChange={(v) => setKind(v as "forward" | "feedback")}
          />
          {kind === "feedback" && (
            <>
              <Select
                label="Trigger"
                value={trigger}
                onChange={(v) => setTrigger(v ?? "verdicts")}
                data={["verdicts", "findings", "needs_revision", "custom"]}
              />
              <NumberInput
                label="Iteration limit (design setting)"
                min={1}
                max={20}
                value={limit}
                onChange={setLimit}
              />
              <Text size="xs" c="dimmed">
                This release stores the limit. It does not run loops or escalate
                reviews.
              </Text>
            </>
          )}
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <TextInput
            label="Payload description"
            value={payloadType}
            onChange={(e) => setPayload(e.target.value)}
          />
          <Button disabled={!source || !target} onClick={addEdge}>
            Save in design
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
