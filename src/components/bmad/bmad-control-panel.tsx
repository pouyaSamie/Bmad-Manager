/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Check,
  KeyRound,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  GripVertical,
  ArrowLeft,
  ArrowRight,
  X,
  RotateCcw,
  Plus,
  Trash2,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  approveBmadOperation,
  draftBmadOperation,
  getBmadControl,
  getBmadSkillContent,
  saveAgentGatewayConfig,
  saveGatewayConfig,
  scanBmadControl,
} from "@/actions/bmad-control-actions";

type Props = { owner: string; name: string };
type Tab = "overview" | "installation" | "agents" | "skills" | "chat" | "activity";

export type WorkflowLoop = {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  trigger: "verdicts" | "findings" | "needs_revision" | "custom";
  description?: string;
};

function SortableWorkflowCard({
  agent,
  index,
  total,
  onMoveLeft,
  onMoveRight,
  onRemove,
  hasLoopsFrom,
  hasLoopsTo,
}: {
  agent: any;
  index: number;
  total: number;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onRemove: () => void;
  hasLoopsFrom: boolean;
  hasLoopsTo: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: agent.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex min-w-44 flex-col justify-between rounded-xl border bg-card p-3 shadow-xs transition-all",
        isDragging && "z-50 opacity-80 ring-2 ring-primary shadow-md",
        (hasLoopsFrom || hasLoopsTo) && "border-primary/40 bg-primary/5",
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-1 text-muted-foreground">
          <button
            {...attributes}
            {...listeners}
            className="flex items-center gap-1 cursor-grab active:cursor-grabbing rounded p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Drag to reorder stage"
          >
            <GripVertical className="size-3.5" />
            <span className="font-mono text-xs font-semibold">Stage {index + 1}</span>
          </button>
          <Button
            size="icon"
            variant="ghost"
            className="size-5 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            title="Remove from workflow"
          >
            <X className="size-3" />
            <span className="sr-only">Remove</span>
          </Button>
        </div>

        <div className="mt-2">
          <p className="font-medium text-foreground flex items-center gap-1.5">
            <span className="text-base">{agent.icon}</span>
            <span className="truncate">{agent.name}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{agent.title}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground/80 truncate">
            {agent.skillName || agent.slug}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-6 text-xs"
            disabled={index === 0}
            onClick={onMoveLeft}
            title="Move earlier"
          >
            <ArrowLeft className="size-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-6 text-xs"
            disabled={index === total - 1}
            onClick={onMoveRight}
            title="Move later"
          >
            <ArrowRight className="size-3" />
          </Button>
        </div>

        {hasLoopsFrom && (
          <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-xs text-primary font-medium flex items-center gap-0.5">
            <RotateCcw className="size-2.5" /> Loop
          </span>
        )}
      </div>
    </div>
  );
}

export function BmadControlPanel({ owner, name }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [gatewayModel, setGatewayModel] = useState("");
  const [gatewayKey, setGatewayKey] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<{ role: string; content: string }[]>([]);
  const [tools, setTools] = useState("codex");
  const [agentDraft, setAgentDraft] = useState({ slug: "", name: "", title: "", icon: "🤖", description: "", persona: "", scope: "team" });
  const [skillDraft, setSkillDraft] = useState({ slug: "", name: "", description: "", persona: "" });
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [editingGateway, setEditingGateway] = useState<any>(null);
  const [editingSkill, setEditingSkill] = useState<any>(null);
  const [skillSearch, setSkillSearch] = useState("");
  const [skillAgentFilter, setSkillAgentFilter] = useState("all");
  const [workflowDraft, setWorkflowDraft] = useState<string[]>([]);
  const [workflowLoops, setWorkflowLoops] = useState<WorkflowLoop[]>([]);
  const [workflowCandidate, setWorkflowCandidate] = useState("");
  const [showAddLoop, setShowAddLoop] = useState(false);
  const [newLoopFrom, setNewLoopFrom] = useState("");
  const [newLoopTo, setNewLoopTo] = useState("");
  const [newLoopTrigger, setNewLoopTrigger] = useState<WorkflowLoop["trigger"]>("verdicts");
  const [newLoopDesc, setNewLoopDesc] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const refresh = async () => {
    const result = await getBmadControl({ owner, name });
    if (result.success) {
      setData(result.data);
      setGatewayUrl((previous) => previous || (result.data as any).runtime.gatewayBaseUrl || "");
      setGatewayModel((previous) => previous || (result.data as any).runtime.gatewayModel || "");
      const foundAgents = (result.data as any).agents ?? [];
      const first = foundAgents[0]?.id;

      const savedWorkflow = (result.data as any).runtime.workflow?.agentIds;
      const savedLoops = (result.data as any).runtime.workflow?.loops;

      const defaultWorkflowAgents = [
        foundAgents.find((a: any) => a.slug === "bmad-agent-analyst" || a.name?.toLowerCase() === "mary"),
        foundAgents.find((a: any) => a.slug === "bmad-agent-pm" || a.name?.toLowerCase() === "john"),
        foundAgents.find((a: any) => a.slug === "bmad-agent-ux-designer" || a.name?.toLowerCase() === "sally"),
        foundAgents.find((a: any) => a.slug === "bmad-agent-architect" || a.name?.toLowerCase() === "winston"),
        foundAgents.find((a: any) => a.slug === "bmad-agent-dev" || a.name?.toLowerCase() === "amelia"),
        foundAgents.find((a: any) => a.slug === "bmad-tea" || a.slug === "bmad-agent-tea" || a.name?.toLowerCase() === "murat"),
        foundAgents.find((a: any) => a.slug === "bmad-agent-po" || a.slug === "bmad-agent-critic" || a.name?.toLowerCase() === "nella"),
      ].filter(Boolean);

      const defaultWorkflow = Array.from(new Set(defaultWorkflowAgents.map((agent: any) => agent.id)));

      // Default loops according to BMad Method
      const defaultLoops: WorkflowLoop[] = [];
      const nella = foundAgents.find((a: any) => a.slug === "bmad-agent-po" || a.slug === "bmad-agent-critic" || a.name?.toLowerCase() === "nella");
      const john = foundAgents.find((a: any) => a.slug === "bmad-agent-pm" || a.name?.toLowerCase() === "john");
      const murat = foundAgents.find((a: any) => a.slug === "bmad-tea" || a.slug === "bmad-agent-tea" || a.name?.toLowerCase() === "murat");

      if (nella && john) {
        defaultLoops.push({
          id: `${nella.id}->${john.id}:verdicts`,
          fromAgentId: nella.id,
          toAgentId: john.id,
          trigger: "verdicts",
          description: "Pass PO critic verdicts and unmet acceptance criteria back to John (PM) to generate stories and iterate implementation",
        });
      }
      if (murat && john) {
        defaultLoops.push({
          id: `${murat.id}->${john.id}:findings`,
          fromAgentId: murat.id,
          toAgentId: john.id,
          trigger: "findings",
          description: "Post QA defects and automated test review findings back to John (PM) for triage",
        });
      }

      setWorkflowDraft(Array.isArray(savedWorkflow) && savedWorkflow.length ? savedWorkflow : defaultWorkflow);
      setWorkflowLoops(Array.isArray(savedLoops) ? savedLoops : defaultLoops);
      setSelectedAgent((previous) => previous || first || "");
    } else {
      setNotice(result.error);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agents = useMemo(() => data?.agents ?? [], [data?.agents]);
  const skills = useMemo(() => data?.skills ?? [], [data?.skills]);
  const operations = useMemo(() => data?.operations ?? [], [data?.operations]);
  const workflowAgents = workflowDraft.map((id) => agents.find((agent: any) => agent.id === id)).filter(Boolean);
  const workflowCandidates = agents.filter((agent: any) => !workflowDraft.includes(agent.id));
  const filteredSkills = skills.filter((skill: any) => {
    const query = skillSearch.trim().toLowerCase();
    const matchesText = !query || `${skill.name} ${skill.description || ""}`.toLowerCase().includes(query);
    return matchesText && (skillAgentFilter === "all" || agents.some((agent: any) => agent.id === skillAgentFilter && agent.skillName === skill.name));
  });
  const activeAgent = useMemo(() => agents.find((agent: any) => agent.id === selectedAgent), [agents, selectedAgent]);

  const act = async (fn: () => Promise<any>) => {
    setBusy(true);
    setNotice("");
    try {
      const result = await fn();
      setNotice(result.success ? "Saved." : result.error);
      if (result.success) await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setWorkflowDraft((items) => {
        const oldIndex = items.indexOf(String(active.id));
        const newIndex = items.indexOf(String(over.id));
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const addFeedbackLoop = () => {
    if (!newLoopFrom || !newLoopTo || newLoopFrom === newLoopTo) return;
    const fromAgent = agents.find((a: any) => a.id === newLoopFrom);
    const toAgent = agents.find((a: any) => a.id === newLoopTo);
    const defaultDescriptions: Record<string, string> = {
      verdicts: `Pass ${fromAgent?.name || "evaluator"} verdicts back to ${toAgent?.name || "PM"} for story generation`,
      findings: `Post ${fromAgent?.name || "test"} findings and defects back to ${toAgent?.name || "PM"} for triage`,
      needs_revision: `Request revisions from ${toAgent?.name || "upstream agent"} when acceptance criteria are not met`,
      custom: `Feedback loop from ${fromAgent?.name} to ${toAgent?.name}`,
    };
    const desc = newLoopDesc.trim() || defaultDescriptions[newLoopTrigger] || "";
    const newLoop: WorkflowLoop = {
      id: `${newLoopFrom}->${newLoopTo}:${newLoopTrigger}-${Date.now()}`,
      fromAgentId: newLoopFrom,
      toAgentId: newLoopTo,
      trigger: newLoopTrigger,
      description: desc,
    };
    setWorkflowLoops((current) => [...current.filter((l) => !(l.fromAgentId === newLoopFrom && l.toAgentId === newLoopTo && l.trigger === newLoopTrigger)), newLoop]);
    setNewLoopDesc("");
    setShowAddLoop(false);
  };

  const removeLoop = (id: string) => {
    setWorkflowLoops((current) => current.filter((l) => l.id !== id));
  };

  const openSkillEditor = async (skill: any) => {
    setBusy(true);
    setNotice("");
    try {
      const result = await getBmadSkillContent({ owner, name, skillId: skill.id });
      if (!result.success) { setNotice(result.error); return; }
      setEditingSkill({
        ...result.data,
        skillId: skill.id,
        slug: result.data.isManaged ? result.data.name : `${result.data.name}-custom`,
        name: result.data.name,
        sourceDirectory: result.data.directory,
        assignAgentId: result.data.isManaged ? "" : agents.find((agent: any) => agent.skillName === result.data.name)?.id ?? "",
      });
    } finally {
      setBusy(false);
    }
  };

  const draftSkillClone = async (skill: any) => {
    setBusy(true);
    setNotice("");
    try {
      const source = await getBmadSkillContent({ owner, name, skillId: skill.id });
      if (!source.success) { setNotice(source.error); return; }
      const assignedAgent = agents.find((agent: any) => agent.skillName === source.data.name);
      const result = await draftBmadOperation({
        owner,
        name,
        kind: "clone_skill",
        payload: {
          slug: `${source.data.name}-custom`,
          name: source.data.name,
          description: source.data.name,
          content: source.data.content,
          sourceDirectory: source.data.directory,
          assignAgentId: assignedAgent?.id ?? "",
        },
      });
      setNotice(result.success ? "Clone draft created. Approve it in Activity & approvals." : result.error);
      if (result.success) await refresh();
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!message.trim() || !selectedAgent) return;
    const userMessage = message.trim();
    setMessage("");
    setChat((previous) => [...previous, { role: "user", content: userMessage }, { role: "assistant", content: "" }]);
    const response = await fetch("/api/bmad/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ owner, name, agentId: selectedAgent, message: userMessage }),
    });
    if (!response.ok || !response.body) {
      const body = await response.json().catch(() => ({ error: "Chat failed" }));
      setChat((previous) => [...previous.slice(0, -1), { role: "assistant", content: body.error ?? "Chat failed" }]);
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let answer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const raw = decoder.decode(value, { stream: true });
      for (const line of raw.split("\n")) {
        if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
        try {
          answer += JSON.parse(line.slice(6)).choices?.[0]?.delta?.content ?? "";
        } catch {}
      }
      setChat((previous) => [...previous.slice(0, -1), { role: "assistant", content: answer }]);
    }
  };

  if (!data) return <div className="p-6 text-sm text-muted-foreground">Loading BMad Control…</div>;
  const runtime = data.runtime;
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "installation", label: "Installation" },
    { id: "agents", label: "Agents" },
    { id: "skills", label: "Skills" },
    { id: "chat", label: "Chat" },
    { id: "activity", label: "Activity & approvals" },
  ];

  return (
    <div className="space-y-6 px-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">BMad Control</h1>
          <p className="mt-1 text-muted-foreground">Configure agents, skills, approvals, and project conversations.</p>
        </div>
        <Button variant="outline" disabled={busy} onClick={() => act(() => scanBmadControl({ owner, name }))}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Scan project
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-3">
        {tabs.map((item) => (
          <Button
            key={item.id}
            variant={tab === item.id ? "default" : "ghost"}
            size="sm"
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {notice && <p className="rounded-lg border p-3 text-sm">{notice}</p>}

      {tab === "overview" && (
        <div className="grid gap-4 md:grid-cols-3">
          <Metric icon={<Bot />} title="Agents" value={agents.length} detail="Default and managed personas" />
          <Metric icon={<Sparkles />} title="Skills" value={skills.length} detail="Discovered from .agents/skills" />
          <Metric icon={<ShieldCheck />} title="Approval queue" value={operations.filter((op: any) => op.status === "draft").length} detail="Writes require review" />

          {/* Enhanced Agent Workflow Section */}
          <section className="rounded-xl border p-5 md:col-span-3 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Agent workflow</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  The project’s controlled handoff order and feedback loops per the BMad Method lifecycle. Drag stages to visually reorder.
                </p>
              </div>
              <Button
                size="sm"
                disabled={busy || !workflowDraft.length}
                onClick={() => act(() => draftBmadOperation({
                  owner,
                  name,
                  kind: "set_workflow",
                  payload: { agentIds: workflowDraft, loops: workflowLoops },
                }))}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Draft workflow change
              </Button>
            </div>

            {/* Visual Drag & Drop Stage Sequence */}
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">Linear Stage Pipeline ({workflowAgents.length} stages)</span>
                <span>Drag stage handle or use arrows to change sequence</span>
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={workflowDraft} strategy={horizontalListSortingStrategy}>
                  <div className="flex flex-wrap items-stretch gap-2">
                    {workflowAgents.map((agent: any, index: number) => {
                      const hasLoopsFrom = workflowLoops.some((l) => l.fromAgentId === agent.id);
                      const hasLoopsTo = workflowLoops.some((l) => l.toAgentId === agent.id);
                      return (
                        <div key={agent.id} className="flex items-center gap-2">
                          <SortableWorkflowCard
                            agent={agent}
                            index={index}
                            total={workflowAgents.length}
                            onMoveLeft={() => {
                              if (index === 0) return;
                              setWorkflowDraft((curr) => {
                                const next = [...curr];
                                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                return next;
                              });
                            }}
                            onMoveRight={() => {
                              if (index === workflowAgents.length - 1) return;
                              setWorkflowDraft((curr) => {
                                const next = [...curr];
                                [next[index + 1], next[index]] = [next[index], next[index + 1]];
                                return next;
                              });
                            }}
                            onRemove={() => {
                              setWorkflowDraft((curr) => curr.filter((id) => id !== agent.id));
                              setWorkflowLoops((curr) => curr.filter((l) => l.fromAgentId !== agent.id && l.toAgentId !== agent.id));
                            }}
                            hasLoopsFrom={hasLoopsFrom}
                            hasLoopsTo={hasLoopsTo}
                          />
                          {index < workflowAgents.length - 1 && (
                            <span className="text-muted-foreground font-bold text-lg select-none">→</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>

              {workflowAgents.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No agents in workflow. Add agents below to construct the delivery pipeline.
                </div>
              )}
            </div>

            {/* Candidate Agent Addition */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-9 min-w-56 rounded-md border bg-background px-3 text-sm"
                value={workflowCandidate}
                onChange={(event) => setWorkflowCandidate(event.target.value)}
              >
                <option value="">Add an agent to the workflow…</option>
                {workflowCandidates.map((agent: any) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.icon} {agent.name} — {agent.title}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                disabled={!workflowCandidate}
                onClick={() => {
                  setWorkflowDraft((current) => [...current, workflowCandidate]);
                  setWorkflowCandidate("");
                }}
              >
                <Plus className="mr-1.5 size-3.5" />
                Add to pipeline
              </Button>
            </div>

            {/* Configured Feedback Loops & Decision Gates */}
            <div className="rounded-xl border p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <RotateCcw className="size-4 text-primary" />
                    Feedback Loops & Quality Gates ({workflowLoops.length})
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    BMad Method protocols for routing verdicts and review findings back to upstream decision-makers.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1"
                  onClick={() => setShowAddLoop(!showAddLoop)}
                >
                  <Plus className="size-3.5" />
                  {showAddLoop ? "Cancel" : "Add custom loop"}
                </Button>
              </div>

              {/* Add Loop Form */}
              {showAddLoop && (
                <div className="rounded-lg border border-primary/30 bg-muted/30 p-3 space-y-3">
                  <p className="text-xs font-medium text-foreground">Configure new feedback loop</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <label className="text-xs text-muted-foreground">From evaluator (source)</label>
                      <select
                        className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-xs"
                        value={newLoopFrom}
                        onChange={(e) => setNewLoopFrom(e.target.value)}
                      >
                        <option value="">Select source agent…</option>
                        {workflowAgents.map((a: any) => (
                          <option key={a.id} value={a.id}>{a.icon} {a.name} ({a.title})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">To receiver (target)</label>
                      <select
                        className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-xs"
                        value={newLoopTo}
                        onChange={(e) => setNewLoopTo(e.target.value)}
                      >
                        <option value="">Select target agent…</option>
                        {workflowAgents.map((a: any) => (
                          <option key={a.id} value={a.id}>{a.icon} {a.name} ({a.title})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">Trigger condition</label>
                      <select
                        className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-xs"
                        value={newLoopTrigger}
                        onChange={(e) => setNewLoopTrigger(e.target.value as WorkflowLoop["trigger"])}
                      >
                        <option value="verdicts">Verdicts (PO/Critic QA gate fails)</option>
                        <option value="findings">Findings (TEA test defects & bugs)</option>
                        <option value="needs_revision">Needs Revision (Story rework)</option>
                        <option value="custom">Custom Condition</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Description & protocol notes</label>
                    <Input
                      className="mt-1 h-8 text-xs"
                      placeholder="e.g. Pass PO verdicts back to John to write prioritized user stories"
                      value={newLoopDesc}
                      onChange={(e) => setNewLoopDesc(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      disabled={!newLoopFrom || !newLoopTo || newLoopFrom === newLoopTo}
                      onClick={addFeedbackLoop}
                    >
                      Save loop
                    </Button>
                  </div>
                </div>
              )}

              {/* Loop Items List */}
              <div className="grid gap-2 sm:grid-cols-2">
                {workflowLoops.map((loop) => {
                  const from = agents.find((a: any) => a.id === loop.fromAgentId);
                  const to = agents.find((a: any) => a.id === loop.toAgentId);
                  return (
                    <div
                      key={loop.id}
                      className="flex items-start justify-between rounded-lg border bg-card p-3 shadow-2xs gap-2"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <span>{from?.icon} {from?.name || "Unknown"}</span>
                          <span className="text-primary font-bold">↺ passes to</span>
                          <span>{to?.icon} {to?.name || "Unknown"}</span>
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wider ml-1",
                            loop.trigger === "verdicts" && "bg-destructive/10 text-destructive border border-destructive/30",
                            loop.trigger === "findings" && "bg-warning/10 text-warning-foreground border border-warning/30",
                            loop.trigger === "needs_revision" && "bg-info/10 text-info border border-info/30",
                            loop.trigger === "custom" && "bg-muted text-muted-foreground border",
                          )}>
                            {loop.trigger}
                          </span>
                        </div>
                        {loop.description && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {loop.description}
                          </p>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => removeLoop(loop.id)}
                        title="Delete feedback loop"
                      >
                        <Trash2 className="size-3.5" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  );
                })}
              </div>

              {workflowLoops.length === 0 && (
                <p className="text-xs text-muted-foreground py-2 italic">
                  No active feedback loops. Configure loops above to enable iterative agile cycles.
                </p>
              )}
            </div>
          </section>

          {/* Gateway Configuration */}
          <section className="rounded-xl border p-5 md:col-span-3">
            <h2 className="font-semibold">Gateway</h2>
            <p className="mt-1 text-sm text-muted-foreground">Each project uses its own encrypted OpenAI-compatible API key.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Input placeholder="https://gateway.example/v1" value={gatewayUrl} onChange={(e) => setGatewayUrl(e.target.value)} />
              <Input placeholder="Model name" value={gatewayModel} onChange={(e) => setGatewayModel(e.target.value)} />
              <Input type="password" placeholder={runtime.gatewayConfigured ? "API key saved — enter to replace" : "API key"} value={gatewayKey} onChange={(e) => setGatewayKey(e.target.value)} />
            </div>
            <Button className="mt-3" disabled={busy} onClick={() => act(() => saveGatewayConfig({ owner, name, gatewayBaseUrl: gatewayUrl, gatewayModel, apiKey: gatewayKey || undefined }))}>
              <KeyRound className="mr-2 h-4 w-4" />Save gateway
            </Button>
          </section>
        </div>
      )}

      {tab === "installation" && (
        <section className="rounded-xl border p-5">
          <h2 className="font-semibold">BMad installation</h2>
          <p className="mt-1 text-sm text-muted-foreground">Status: {runtime.installStatus}. Installed version: {runtime.installedVersion ?? "not detected"}.</p>
          <p className="mt-3 text-sm">Installation uses the official stable installer with BMM defaults. Enter one or more official tool IDs, then review the command in Activity before approving.</p>
          <Input className="mt-4 max-w-xl" value={tools} onChange={(event) => setTools(event.target.value)} placeholder="codex, claude-code" />
          <Button className="mt-3" disabled={busy} onClick={() => act(() => draftBmadOperation({ owner, name, kind: runtime.installStatus === "ready" ? "update" : "install", payload: { tools: tools.split(",").map((tool) => tool.trim()).filter(Boolean) } }))}>
            <TerminalSquare className="mr-2 h-4 w-4" />Draft {runtime.installStatus === "ready" ? "update" : "install"}
          </Button>
        </section>
      )}

      {tab === "agents" && (
        <section className="space-y-3">
          {agents.map((agent: any) => (
            <div key={agent.id} className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border p-4">
                <div>
                  <p className="font-medium">{agent.icon} {agent.name} <span className="text-muted-foreground">— {agent.title}</span></p>
                  <p className="mt-1 text-sm text-muted-foreground">Skill: {agent.skillName || agent.slug} · {agent.description || "No project description"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Model route: {agent.gatewayConfigured ? `${agent.providerLabel} · ${agent.gatewayModel}` : "Project default gateway"}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant={editingGateway?.id === agent.id ? "default" : "outline"} onClick={() => setEditingGateway(editingGateway?.id === agent.id ? null : { ...agent, route: agent.providerLabel === "OpenAI / Codex API" ? "openai" : agent.providerLabel === "OpenRouter" ? "openrouter" : agent.providerLabel === "Ollama" ? "ollama" : agent.providerLabel === "LM Studio" ? "lm-studio" : agent.gatewayConfigured ? "custom" : "project", apiKey: "" })}>Model route</Button>
                  <Button size="sm" variant={editingAgent?.id === agent.id ? "default" : "outline"} onClick={() => setEditingAgent(editingAgent?.id === agent.id ? null : { ...agent, skillName: agent.skillName || agent.slug, persona: agent.persona || "", scope: agent.scope === "personal" ? "personal" : "team" })}>Customize</Button>
                  <Button size="sm" variant="outline" onClick={() => { setSelectedAgent(agent.id); setTab("chat"); }}>Chat</Button>
                </div>
              </div>
              {editingGateway?.id === agent.id && (
                <section className="rounded-xl border border-info/50 bg-info/5 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">Model route for {agent.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">This host-side route powers BmadManager chat. The BMad skill and persona stay attached to {agent.name}.</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setEditingGateway(null)}>Close</Button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <select className="h-9 rounded-md border bg-background px-3 text-sm" value={editingGateway.route} onChange={(event) => { const route = event.target.value; const defaults: Record<string, string> = { openai: "https://api.openai.com/v1", openrouter: "https://openrouter.ai/api/v1", ollama: "http://localhost:11434/v1", "lm-studio": "http://localhost:1234/v1" }; setEditingGateway({ ...editingGateway, route, gatewayBaseUrl: route === "project" ? "" : defaults[route] || editingGateway.gatewayBaseUrl || "" }); }}>
                      <option value="project">Use project default</option>
                      <option value="openai">OpenAI / Codex API</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="ollama">Ollama (local)</option>
                      <option value="lm-studio">LM Studio (local)</option>
                      <option value="custom">Custom compatible endpoint</option>
                    </select>
                    {editingGateway.route !== "project" && (
                      <>
                        <Input value={editingGateway.gatewayBaseUrl || ""} onChange={(event) => setEditingGateway({ ...editingGateway, gatewayBaseUrl: event.target.value })} placeholder="https://gateway.example/v1" />
                        <Input value={editingGateway.gatewayModel || ""} onChange={(event) => setEditingGateway({ ...editingGateway, gatewayModel: event.target.value })} placeholder="Model ID" />
                        <Input className="md:col-span-3" type="password" value={editingGateway.apiKey || ""} onChange={(event) => setEditingGateway({ ...editingGateway, apiKey: event.target.value })} placeholder={agent.gatewayKeyConfigured ? "API key saved — enter only to replace" : "API key (optional for local servers)"} />
                      </>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">OpenAI/Codex and OpenRouter normally need an API key. Ollama and LM Studio usually do not. For a containerized app, local gateways may use host.docker.internal instead of localhost.</p>
                  <Button className="mt-3" disabled={busy || (editingGateway.route !== "project" && (!editingGateway.gatewayBaseUrl || !editingGateway.gatewayModel))} onClick={() => act(() => saveAgentGatewayConfig({ owner, name, agentId: agent.id, route: editingGateway.route, gatewayBaseUrl: editingGateway.gatewayBaseUrl || undefined, gatewayModel: editingGateway.gatewayModel || undefined, apiKey: editingGateway.apiKey || undefined }))}>
                    <KeyRound className="mr-2 h-4 w-4" />Save model route
                  </Button>
                </section>
              )}
              {editingAgent?.id === agent.id && (
                <section className="rounded-xl border border-primary/50 bg-muted/30 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">Customize {editingAgent.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">Draft a safe override; the installed agent stays read-only.</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setEditingAgent(null)}>Close</Button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Input value={editingAgent.name} onChange={(event) => setEditingAgent({ ...editingAgent, name: event.target.value })} placeholder="Name" />
                    <Input value={editingAgent.title} onChange={(event) => setEditingAgent({ ...editingAgent, title: event.target.value })} placeholder="Title" />
                    <Input value={editingAgent.icon} onChange={(event) => setEditingAgent({ ...editingAgent, icon: event.target.value })} placeholder="Icon" />
                    <select className="h-9 rounded-md border bg-background px-3 text-sm" value={editingAgent.skillName} onChange={(event) => setEditingAgent({ ...editingAgent, skillName: event.target.value })}>
                      {skills.map((skill: any) => <option key={skill.id} value={skill.name}>{skill.name}</option>)}
                    </select>
                    <Textarea className="min-h-24 md:col-span-2" value={editingAgent.description || ""} onChange={(event) => setEditingAgent({ ...editingAgent, description: event.target.value })} placeholder="Identity and communication style" />
                    <Textarea className="min-h-40 md:col-span-2" value={editingAgent.persona || ""} onChange={(event) => setEditingAgent({ ...editingAgent, persona: event.target.value })} placeholder="Persona, principles, persistent facts, activation hooks, and menu actions" />
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editingAgent.scope === "personal"} onChange={(event) => setEditingAgent({ ...editingAgent, scope: event.target.checked ? "personal" : "team" })} />
                    Personal override (.user.toml)
                  </label>
                  <Button className="mt-3" disabled={busy || !editingAgent.skillName} onClick={() => act(() => draftBmadOperation({ owner, name, kind: "customize_agent", payload: { agentId: editingAgent.id, slug: editingAgent.slug, skillName: editingAgent.skillName, name: editingAgent.name, title: editingAgent.title, icon: editingAgent.icon, description: editingAgent.description || "", persona: editingAgent.persona || "", scope: editingAgent.scope } }))}>
                    <Sparkles className="mr-2 h-4 w-4" />Draft agent customization
                  </Button>
                </section>
              )}
            </div>
          ))}
          <section className="rounded-xl border p-5">
            <h2 className="font-semibold">New managed agent</h2>
            <p className="mt-1 text-sm text-muted-foreground">Creates a project chat persona plus a portable skill after review and approval. BMM defaults stay unchanged.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input value={agentDraft.slug} onChange={(event) => setAgentDraft({ ...agentDraft, slug: event.target.value })} placeholder="Skill slug, e.g. security-reviewer" />
              <Input value={agentDraft.name} onChange={(event) => setAgentDraft({ ...agentDraft, name: event.target.value })} placeholder="Name" />
              <Input value={agentDraft.title} onChange={(event) => setAgentDraft({ ...agentDraft, title: event.target.value })} placeholder="Role / title" />
              <Input value={agentDraft.icon} onChange={(event) => setAgentDraft({ ...agentDraft, icon: event.target.value })} placeholder="Icon" />
              <Input className="md:col-span-2" value={agentDraft.description} onChange={(event) => setAgentDraft({ ...agentDraft, description: event.target.value })} placeholder="Identity and communication style" />
              <Textarea className="md:col-span-2" value={agentDraft.persona} onChange={(event) => setAgentDraft({ ...agentDraft, persona: event.target.value })} placeholder="Principles, persistent facts, activation notes, and menu actions" />
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={agentDraft.scope === "personal"} onChange={(event) => setAgentDraft({ ...agentDraft, scope: event.target.checked ? "personal" : "team" })} />
              Personal override (.user.toml)
            </label>
            <Button className="mt-3" disabled={busy || !agentDraft.slug || !agentDraft.name} onClick={() => act(() => draftBmadOperation({ owner, name, kind: "create_agent", payload: agentDraft }))}>
              <Sparkles className="mr-2 h-4 w-4" />Draft custom agent
            </Button>
          </section>
        </section>
      )}

      {tab === "skills" && (
        <section className="space-y-3">
          <section className="grid gap-3 rounded-xl border p-4 md:grid-cols-2">
            <Input value={skillSearch} onChange={(event) => setSkillSearch(event.target.value)} placeholder="Search skills by title or description" />
            <select className="h-9 rounded-md border bg-background px-3 text-sm" value={skillAgentFilter} onChange={(event) => setSkillAgentFilter(event.target.value)}>
              <option value="all">All agents</option>
              {agents.map((agent: any) => <option key={agent.id} value={agent.id}>{agent.icon} {agent.name}</option>)}
            </select>
          </section>
          {filteredSkills.map((skill: any) => {
            const usedBy = agents.filter((agent: any) => agent.skillName === skill.name);
            return (
              <div key={skill.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{skill.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{skill.description || "No description"}</p>
                    <p className="mt-2 font-mono text-xs text-muted-foreground">{skill.directory} · {skill.isManaged ? "managed" : "installed read-only"}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Used by: {usedBy.length ? usedBy.map((agent: any) => `${agent.icon} ${agent.name}`).join(", ") : "No agent assigned"}</p>
                  </div>
                  <div className="flex gap-2">
                    {!skill.isManaged && <Button size="sm" variant="outline" disabled={busy} onClick={() => void draftSkillClone(skill)}>Clone</Button>}
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void openSkillEditor(skill)}>{skill.isManaged ? "Edit" : "Edit copy"}</Button>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredSkills.length === 0 && <p className="rounded-xl border p-4 text-sm text-muted-foreground">No skills match this search or agent filter.</p>}
          {editingSkill && (
            <section className="rounded-xl border border-primary/50 bg-muted/30 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{editingSkill.isManaged ? "Edit managed skill" : `Clone ${editingSkill.name}`}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{editingSkill.isManaged ? "Changes are written only after approval." : "The original remains read-only; the clone will be created in .agents/skills/."}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setEditingSkill(null)}>Close</Button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Input value={editingSkill.slug} onChange={(event) => setEditingSkill({ ...editingSkill, slug: event.target.value })} placeholder="Managed skill slug" />
                <Input value={editingSkill.name} onChange={(event) => setEditingSkill({ ...editingSkill, name: event.target.value })} placeholder="Display name" />
                {!editingSkill.isManaged && (
                  <select className="h-9 rounded-md border bg-background px-3 text-sm md:col-span-2" value={editingSkill.assignAgentId} onChange={(event) => setEditingSkill({ ...editingSkill, assignAgentId: event.target.value })}>
                    <option value="">Do not assign this clone yet</option>
                    {agents.map((agent: any) => <option key={agent.id} value={agent.id}>Assign to {agent.icon} {agent.name}</option>)}
                  </select>
                )}
              </div>
              <Textarea className="mt-3 min-h-80" value={editingSkill.content} onChange={(event) => setEditingSkill({ ...editingSkill, content: event.target.value })} placeholder="SKILL.md content" />
              <Button className="mt-3" disabled={busy || !editingSkill.slug || !editingSkill.content} onClick={() => act(() => draftBmadOperation({ owner, name, kind: editingSkill.isManaged ? "write_skill" : "clone_skill", payload: { slug: editingSkill.slug, name: editingSkill.name, description: editingSkill.name, content: editingSkill.content, sourceDirectory: editingSkill.sourceDirectory, assignAgentId: editingSkill.assignAgentId } }))}>
                <Sparkles className="mr-2 h-4 w-4" />Draft {editingSkill.isManaged ? "skill update" : "skill clone"}
              </Button>
            </section>
          )}
          <section className="rounded-xl border p-5">
            <h2 className="font-semibold">New managed skill</h2>
            <p className="mt-1 text-sm text-muted-foreground">Vendor-installed skills are read-only. This drafts a separate managed skill for review.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input value={skillDraft.slug} onChange={(event) => setSkillDraft({ ...skillDraft, slug: event.target.value })} placeholder="Skill slug" />
              <Input value={skillDraft.name} onChange={(event) => setSkillDraft({ ...skillDraft, name: event.target.value })} placeholder="Display name" />
              <Input className="md:col-span-2" value={skillDraft.description} onChange={(event) => setSkillDraft({ ...skillDraft, description: event.target.value })} placeholder="Description" />
              <Textarea className="md:col-span-2" value={skillDraft.persona} onChange={(event) => setSkillDraft({ ...skillDraft, persona: event.target.value })} placeholder="Skill instructions" />
            </div>
            <Button className="mt-3" disabled={busy || !skillDraft.slug} onClick={() => act(() => draftBmadOperation({ owner, name, kind: "write_skill", payload: skillDraft }))}>
              <Sparkles className="mr-2 h-4 w-4" />Draft managed skill
            </Button>
          </section>
        </section>
      )}

      {tab === "chat" && (
        <section className="rounded-xl border">
          <div className="border-b p-4">
            <label className="text-sm font-medium">Agent</label>
            <select className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm" value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}>
              {agents.map((agent: any) => <option key={agent.id} value={agent.id}>{agent.icon} {agent.name} — {agent.title}</option>)}
            </select>
            {activeAgent && <p className="mt-2 text-xs text-muted-foreground">{activeAgent.description} · Route: {activeAgent.gatewayConfigured ? `${activeAgent.providerLabel} / ${activeAgent.gatewayModel}` : "Project default gateway"}</p>}
          </div>
          <div className="min-h-80 space-y-3 p-4">
            {chat.length === 0 && <p className="text-sm text-muted-foreground">Start a conversation. Agents can explain configuration and propose reviewable operations; they cannot make direct project changes.</p>}
            {chat.map((entry, index) => (
              <div key={index} className={entry.role === "user" ? "ml-auto max-w-3xl rounded-lg bg-primary p-3 text-sm text-primary-foreground" : "max-w-3xl rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap"}>
                {entry.content || "…"}
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t p-4">
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask this BMad agent about the project…" className="min-h-10" />
            <Button disabled={!message.trim() || !selectedAgent} onClick={send}>
              <MessageSquare className="mr-2 h-4 w-4" />Send
            </Button>
          </div>
        </section>
      )}

      {tab === "activity" && (
        <section className="space-y-3">
          {operations.length === 0 && <p className="text-sm text-muted-foreground">No operations yet.</p>}
          {operations.map((operation: any) => (
            <div key={operation.id} className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{operation.kind}</p>
                  <p className="text-xs text-muted-foreground">{operation.status} · {new Date(operation.createdAt).toLocaleString()}</p>
                </div>
                {operation.status === "draft" && (
                  <Button size="sm" disabled={busy} onClick={() => act(() => approveBmadOperation({ owner, name, operationId: operation.id }))}>
                    <Check className="mr-2 h-4 w-4" />Approve
                  </Button>
                )}
              </div>
              <pre className="mt-3 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(operation.preview, null, 2)}</pre>
              {operation.output && <pre className="mt-3 overflow-auto rounded bg-muted p-3 text-xs">{operation.output}</pre>}
              {operation.error && <p className="mt-3 text-sm text-destructive">{operation.error}</p>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function Metric({ icon, title, value, detail }: { icon: React.ReactNode; title: string; value: number; detail: string }) {
  return (
    <section className="rounded-xl border p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{title}</span>
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </section>
  );
}
