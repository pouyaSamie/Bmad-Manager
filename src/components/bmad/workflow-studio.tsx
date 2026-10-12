/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo } from "react";
import {
  GripVertical,
  ArrowLeft,
  ArrowRight,
  X,
  RotateCcw,
  Plus,
  Trash2,
  Sparkles,
  Zap,
  ShieldCheck,
  CheckCircle2,
  Settings2,
  Search,
  BookOpen,
  Bot,
  Layers,
  Cpu,
  ChevronRight,
  SlidersHorizontal,
  Workflow,
  KeyRound,
  Check,
  AlertTriangle,
  ArrowUpRight,
  Terminal,
  FolderGit2,
  Play,
  Share2,
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
export * from "./workflow-types";
import { ROLE_META_MAP, getAgentMeta, type WorkflowLoop, type AgentRoleMeta } from "./workflow-types";
import { AgentWorkflowCanvas } from "./agent-workflow-canvas";

// Preset Workflows Definition
const WORKFLOW_PRESETS = [
  {
    id: "bmad_standard",
    name: "BMad Standard Full Lifecycle",
    desc: "7-agent continuous agile loop with PO Critic verdict gates and TEA test advisor loops",
    icon: "👑",
    agentSlugs: ["mary", "john", "sally", "winston", "amelia", "murat", "nella"],
    loops: [
      {
        from: "nella",
        to: "john",
        trigger: "verdicts" as const,
        description: "Pass PO Critic review verdicts and acceptance criteria gaps to John (PM) to generate prioritized stories",
        maxIterations: 3,
        payloadType: "PO verdict notes & rejected criteria",
      },
      {
        from: "murat",
        to: "amelia",
        trigger: "findings" as const,
        description: "Post automated test failures and quality findings directly back to Amelia for red-green-refactor fix",
        maxIterations: 5,
        payloadType: "Vitest error traces & failing assertions",
      },
    ],
  },
  {
    id: "rapid_spike",
    name: "Rapid Dev Spike",
    desc: "Compact 3-agent iteration loop (PM → Dev ↔ Test Advisor)",
    icon: "⚡",
    agentSlugs: ["john", "amelia", "murat"],
    loops: [
      {
        from: "murat",
        to: "amelia",
        trigger: "findings" as const,
        description: "Instant test failure and regression triage back to developer",
        maxIterations: 4,
        payloadType: "Failing tests & diff patch",
      },
    ],
  },
  {
    id: "architecture_spec",
    name: "Architecture & Spec Review",
    desc: "Analyst → PM → Architect → PO Critic high-level design pipeline",
    icon: "🏗️",
    agentSlugs: ["mary", "john", "winston", "nella"],
    loops: [
      {
        from: "nella",
        to: "john",
        trigger: "verdicts" as const,
        description: "Evaluate architectural feasibility against core product vision",
        maxIterations: 2,
        payloadType: "Architecture gap analysis",
      },
    ],
  },
];

// Rich Interactive Agent Card for Canvas and Linear Track
function RichAgentCard({
  agent,
  index,
  total,
  onMoveLeft,
  onMoveRight,
  onRemove,
  onSelect,
  isSelected,
  loopsFrom,
  loopsTo,
  onDropSkill,
  compact = false,
}: {
  agent: any;
  index: number;
  total: number;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onRemove?: () => void;
  onSelect: () => void;
  isSelected: boolean;
  loopsFrom: WorkflowLoop[];
  loopsTo: WorkflowLoop[];
  onDropSkill: (skillName: string) => void;
  compact?: boolean;
}) {
  const [isDragOverSkill, setIsDragOverSkill] = useState(false);
  const meta = getAgentMeta(agent);

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/bmad-skill")) {
      e.preventDefault();
      setIsDragOverSkill(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOverSkill(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverSkill(false);
    const skillName = e.dataTransfer.getData("application/bmad-skill");
    if (skillName) {
      onDropSkill(skillName);
    }
  };

  const modelDisplay = agent.gatewayConfigured
    ? `${agent.gatewayModel || "Custom"}`
    : meta.defaultModel;

  return (
    <div
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl border bg-card p-4 transition-all duration-200 cursor-pointer shadow-xs",
        compact ? "w-64 shrink-0" : "w-full",
        meta.border,
        isSelected
          ? "ring-2 ring-primary shadow-lg border-primary"
          : "hover:border-primary/50 hover:shadow-md",
        (loopsFrom.length > 0 || loopsTo.length > 0) && "bg-gradient-to-b from-card to-muted/20",
        isDragOverSkill && "ring-2 ring-emerald-500 bg-emerald-500/10 border-emerald-500",
      )}
    >
      {/* Top Header: Stage Indicator + Action Toolbar */}
      <div>
        <div className="flex items-center justify-between gap-1 text-muted-foreground pb-2.5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <span className="font-mono text-3xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted text-foreground/80">
              Stage {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-3xs text-muted-foreground font-medium hidden sm:inline">
              {meta.phase.split(". ")[1] || meta.phase}
            </span>
          </div>

          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              size="icon"
              variant="ghost"
              className="size-6 text-muted-foreground hover:text-foreground"
              onClick={onSelect}
              title="Configure model, persona, tools & prompts"
            >
              <Settings2 className="size-3.5" />
              <span className="sr-only">Configure</span>
            </Button>
            {onRemove && (
              <Button
                size="icon"
                variant="ghost"
                className="size-6 text-muted-foreground hover:text-destructive"
                onClick={onRemove}
                title="Remove agent from pipeline"
              >
                <X className="size-3.5" />
                <span className="sr-only">Remove</span>
              </Button>
            )}
          </div>
        </div>

        {/* Identity & Role Header */}
        <div className="mt-3 flex items-start gap-3">
          <div className="size-10 rounded-xl bg-muted/80 flex items-center justify-center shrink-0 border border-border/60 text-2xl shadow-2xs">
            {meta.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <h4 className="font-semibold text-sm text-foreground truncate">{agent.name}</h4>
              <span className={cn("text-3xs font-medium px-2 py-0.25 rounded-md border shrink-0", meta.badge)}>
                {meta.role}
              </span>
            </div>
            {/* Model Badge */}
            <div className="mt-1 flex items-center gap-1 text-3xs text-muted-foreground font-mono">
              <Cpu className="size-3 text-primary shrink-0" />
              <span className="truncate text-foreground/90 font-medium">{modelDisplay}</span>
            </div>
          </div>
        </div>

        {/* I/O Contracts (Clear Data Flow) */}
        <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-2 text-xs space-y-1">
          <div className="flex items-start gap-1.5">
            <span className="font-mono text-3xs font-bold text-muted-foreground shrink-0 uppercase tracking-wider">In:</span>
            <span className="text-3xs text-foreground/80 line-clamp-1 font-medium" title={meta.inputContract}>{meta.inputContract}</span>
          </div>
          <div className="flex items-start gap-1.5 border-t border-border/40 pt-1">
            <span className="font-mono text-3xs font-bold text-primary shrink-0 uppercase tracking-wider">Out:</span>
            <span className="text-3xs text-foreground/90 font-semibold line-clamp-1" title={meta.outputContract}>{meta.outputContract}</span>
          </div>
        </div>

        {/* Attached Skill Slot with Drop Target */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "mt-3 rounded-xl border border-dashed p-2 transition-colors",
            isDragOverSkill
              ? "border-emerald-500 bg-emerald-500/15"
              : "border-border/70 bg-muted/20 hover:border-primary/50",
          )}
          title="Drop a skill here from the palette to rebind"
        >
          <div className="flex items-center justify-between text-3xs mb-1">
            <span className="font-semibold flex items-center gap-1 text-foreground/90">
              <Zap className="size-2.5 text-amber-500 shrink-0" />
              <span>Skill</span>
            </span>
            <span className="text-3xs text-muted-foreground font-mono">
              drop to rebind
            </span>
          </div>
          <p className="font-mono text-xs font-semibold text-foreground truncate bg-background/90 px-2 py-1 rounded border border-border/60">
            {agent.skillName || agent.slug}
          </p>
        </div>

        {/* Active Feedback Loop Annotations on Card */}
        {loopsTo.length > 0 && (
          <div className="mt-2.5 space-y-1">
            {loopsTo.map((loop) => (
              <div
                key={loop.id}
                className="flex items-center gap-1.5 rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-1 text-3xs text-blue-600 dark:text-blue-400 font-semibold truncate"
              >
                <RotateCcw className="size-3 shrink-0 text-blue-500 animate-spin-slow" />
                <span className="truncate">Receives: {loop.trigger} loop</span>
              </div>
            ))}
          </div>
        )}
        {loopsFrom.length > 0 && (
          <div className="mt-2.5 space-y-1">
            {loopsFrom.map((loop) => (
              <div
                key={loop.id}
                className="flex items-center gap-1.5 rounded-md bg-rose-500/10 border border-rose-500/20 px-2 py-1 text-3xs text-rose-600 dark:text-rose-400 font-semibold truncate"
              >
                <RotateCcw className="size-3 shrink-0 text-rose-500" />
                <span className="truncate">Initiates: {loop.trigger} loop</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Card Footer: Reorder Controls or Click Hint */}
      <div className="mt-3.5 flex items-center justify-between border-t border-border/40 pt-2 text-3xs text-muted-foreground">
        {onMoveLeft && onMoveRight ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              size="icon"
              variant="ghost"
              className="size-6 text-xs"
              disabled={index === 0}
              onClick={onMoveLeft}
              title="Move earlier in pipeline"
            >
              <ArrowLeft className="size-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-6 text-xs"
              disabled={index === total - 1}
              onClick={onMoveRight}
              title="Move later in pipeline"
            >
              <ArrowRight className="size-3" />
            </Button>
          </div>
        ) : (
          <span className="flex items-center gap-1 font-mono text-muted-foreground/80">
            <CheckCircle2 className="size-3 text-emerald-500" />
            Ready
          </span>
        )}

        <span className="text-primary font-medium hover:underline flex items-center gap-0.5">
          Configure <ChevronRight className="size-3" />
        </span>
      </div>
    </div>
  );
}

// Sortable wrapper for DnD linear track
function SortableStageItem({
  agent,
  index,
  total,
  onMoveLeft,
  onMoveRight,
  onRemove,
  onSelect,
  isSelected,
  loopsFrom,
  loopsTo,
  onDropSkill,
}: {
  agent: any;
  index: number;
  total: number;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onRemove: () => void;
  onSelect: () => void;
  isSelected: boolean;
  loopsFrom: WorkflowLoop[];
  loopsTo: WorkflowLoop[];
  onDropSkill: (skillName: string) => void;
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
    <div ref={setNodeRef} style={style} className={cn("relative", isDragging && "z-50 opacity-80")}>
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-20 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted text-muted-foreground"
        title="Drag to reorder"
      >
        <GripVertical className="size-3.5" />
      </div>
      <RichAgentCard
        agent={agent}
        index={index}
        total={total}
        onMoveLeft={onMoveLeft}
        onMoveRight={onMoveRight}
        onRemove={onRemove}
        onSelect={onSelect}
        isSelected={isSelected}
        loopsFrom={loopsFrom}
        loopsTo={loopsTo}
        onDropSkill={onDropSkill}
        compact
      />
    </div>
  );
}

export function WorkflowStudio({
  agents,
  skills,
  workflowDraft,
  workflowLoops,
  setWorkflowDraft,
  setWorkflowLoops,
  onDraftSave,
  busy,
  owner,
  name,
  runtime,
  onSaveAgentGateway,
  onSaveAgentCustomization,
  onCustomizeAgent,
}: {
  agents: any[];
  skills: any[];
  workflowDraft: string[];
  workflowLoops: WorkflowLoop[];
  setWorkflowDraft: React.Dispatch<React.SetStateAction<string[]>>;
  setWorkflowLoops: React.Dispatch<React.SetStateAction<WorkflowLoop[]>>;
  onDraftSave: () => void;
  busy: boolean;
  owner?: string;
  name?: string;
  runtime?: any;
  onSaveAgentGateway?: (payload: any) => Promise<any>;
  onSaveAgentCustomization?: (payload: any) => Promise<any>;
  onCustomizeAgent?: (agent: any) => void;
}) {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedLoopId, setSelectedLoopId] = useState<string | null>(null);
  const [studioView, setStudioView] = useState<"canvas" | "flow" | "sequence">("canvas");
  const [paletteTab, setPaletteTab] = useState<"agents" | "skills">("agents");
  const [paletteSearch, setPaletteSearch] = useState("");
  const [showAddLoopModal, setShowAddLoopModal] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"model" | "persona" | "loop">("model");

  // Agent Form State inside Inspector Drawer
  const [agentForm, setAgentForm] = useState<{
    id: string;
    slug: string;
    name: string;
    title: string;
    icon: string;
    skillName: string;
    description: string;
    persona: string;
    scope: "team" | "personal";
    route: string;
    gatewayBaseUrl: string;
    gatewayModel: string;
    apiKey: string;
  } | null>(null);

  // New Loop Modal State
  const [newLoopFrom, setNewLoopFrom] = useState("");
  const [newLoopTo, setNewLoopTo] = useState("");
  const [newLoopTrigger, setNewLoopTrigger] = useState<WorkflowLoop["trigger"]>("verdicts");
  const [newLoopDesc, setNewLoopDesc] = useState("");
  const [newLoopMaxIter, setNewLoopMaxIter] = useState(3);

  const [notice, setNotice] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Active agents in pipeline
  const pipelineAgents = useMemo(() => {
    return workflowDraft
      .map((id) => agents.find((a) => a.id === id))
      .filter(Boolean);
  }, [workflowDraft, agents]);

  // Candidate agents not yet in pipeline
  const candidateAgents = useMemo(() => {
    return agents.filter((a) => !workflowDraft.includes(a.id));
  }, [agents, workflowDraft]);

  // Filtered skills
  const filteredSkills = useMemo(() => {
    if (!paletteSearch.trim()) return skills;
    const q = paletteSearch.toLowerCase();
    return skills.filter(
      (s) => s.name?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q),
    );
  }, [skills, paletteSearch]);

  // Selected agent object
  const selectedAgent = useMemo(() => {
    return agents.find((a) => a.id === selectedAgentId) || null;
  }, [agents, selectedAgentId]);

  // Selected loop object
  const selectedLoop = useMemo(() => {
    return workflowLoops.find((l) => l.id === selectedLoopId) || null;
  }, [workflowLoops, selectedLoopId]);

  // Synchronize form when selectedAgent changes
  const handleSelectAgent = (agent: any) => {
    setSelectedLoopId(null);
    setSelectedAgentId(agent.id);
    setInspectorTab("model");
    const meta = getAgentMeta(agent);
    setAgentForm({
      id: agent.id,
      slug: agent.slug || agent.name.toLowerCase().replace(/\s+/g, "-"),
      name: agent.name,
      title: agent.title || meta.role,
      icon: agent.icon || meta.icon,
      skillName: agent.skillName || agent.slug || "bmad-agent-analyst",
      description: agent.description || "",
      persona: agent.persona || "",
      scope: agent.scope === "personal" ? "personal" : "team",
      route: agent.providerLabel === "Antigravity (AGY)"
        ? "agy"
        : agent.providerLabel === "Google Gemini"
        ? "gemini"
        : agent.providerLabel === "OpenAI / Codex API"
        ? "openai"
        : agent.providerLabel === "OpenRouter"
        ? "openrouter"
        : agent.providerLabel === "Ollama"
        ? "ollama"
        : agent.providerLabel === "LM Studio"
        ? "lm-studio"
        : agent.gatewayConfigured
        ? "custom"
        : "project",
      gatewayBaseUrl: agent.gatewayBaseUrl || "",
      gatewayModel: agent.gatewayModel || meta.defaultModel,
      apiKey: "",
    });
  };

  const handleSelectLoop = (loop: WorkflowLoop) => {
    setSelectedAgentId(null);
    setSelectedLoopId(loop.id);
    setInspectorTab("loop");
  };

  // Drag End for DnD Sequence
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

  // Add agent to pipeline
  const addAgentToPipeline = (agentId: string) => {
    if (!workflowDraft.includes(agentId)) {
      setWorkflowDraft((curr) => [...curr, agentId]);
    }
  };

  // Remove agent from pipeline
  const removeAgentFromPipeline = (agentId: string) => {
    setWorkflowDraft((curr) => curr.filter((id) => id !== agentId));
    setWorkflowLoops((curr) =>
      curr.filter((l) => l.fromAgentId !== agentId && l.toAgentId !== agentId),
    );
    if (selectedAgentId === agentId) setSelectedAgentId(null);
  };

  // Rebind agent skill
  const handleRebindSkill = async (agentId: string, skillName: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;
    if (onSaveAgentCustomization) {
      setNotice(`Updating ${agent.name} skill to ${skillName}...`);
      await onSaveAgentCustomization({
        agentId: agent.id,
        slug: agent.slug,
        skillName,
        name: agent.name,
        title: agent.title,
        icon: agent.icon,
        description: agent.description || "",
        persona: agent.persona || "",
        scope: agent.scope || "team",
      });
      setNotice(`Saved ${agent.name} with skill ${skillName}`);
    }
  };

  // Save Agent Model Gateway
  const handleSaveModelRoute = async () => {
    if (!agentForm || !onSaveAgentGateway) return;
    setNotice("Saving model route...");
    await onSaveAgentGateway({
      agentId: agentForm.id,
      route: agentForm.route,
      gatewayBaseUrl: agentForm.gatewayBaseUrl || undefined,
      gatewayModel: agentForm.gatewayModel || undefined,
      apiKey: agentForm.apiKey || undefined,
    });
    setNotice("Model route saved successfully!");
  };

  // Save Agent Customization
  const handleSaveAgentCustomization = async () => {
    if (!agentForm || !onSaveAgentCustomization) return;
    setNotice("Drafting agent customization...");
    await onSaveAgentCustomization({
      agentId: agentForm.id,
      slug: agentForm.slug,
      skillName: agentForm.skillName,
      name: agentForm.name,
      title: agentForm.title,
      icon: agentForm.icon,
      description: agentForm.description,
      persona: agentForm.persona,
      scope: agentForm.scope,
    });
    setNotice("Agent customization drafted into approval queue!");
  };

  // Apply a preset
  const applyPreset = (presetId: string) => {
    const preset = WORKFLOW_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const matchedAgentIds: string[] = [];
    for (const slug of preset.agentSlugs) {
      const found = agents.find(
        (a) =>
          a.slug?.toLowerCase().includes(slug) ||
          a.name?.toLowerCase().includes(slug),
      );
      if (found && !matchedAgentIds.includes(found.id)) {
        matchedAgentIds.push(found.id);
      }
    }

    setWorkflowDraft(matchedAgentIds);

    const generatedLoops: WorkflowLoop[] = [];
    for (const loopSpec of preset.loops) {
      const fromAgent = agents.find(
        (a) =>
          a.slug?.toLowerCase().includes(loopSpec.from) ||
          a.name?.toLowerCase().includes(loopSpec.from),
      );
      const toAgent = agents.find(
        (a) =>
          a.slug?.toLowerCase().includes(loopSpec.to) ||
          a.name?.toLowerCase().includes(loopSpec.to),
      );

      if (fromAgent && toAgent) {
        generatedLoops.push({
          id: `${fromAgent.id}->${toAgent.id}:${loopSpec.trigger}`,
          fromAgentId: fromAgent.id,
          toAgentId: toAgent.id,
          trigger: loopSpec.trigger,
          description: loopSpec.description,
          maxIterations: loopSpec.maxIterations,
          payloadType: loopSpec.payloadType,
        });
      }
    }
    setWorkflowLoops(generatedLoops);
    setNotice(`Applied preset: ${preset.name}`);
  };

  // Add loop
  const handleAddLoop = () => {
    if (!newLoopFrom || !newLoopTo || newLoopFrom === newLoopTo) return;
    const id = `${newLoopFrom}->${newLoopTo}:${newLoopTrigger}-${Date.now()}`;
    const defaultDescriptions: Record<WorkflowLoop["trigger"], string> = {
      verdicts: "Route PO Critic acceptance verdicts and criteria gaps backward to PM for story refinement",
      findings: "Route automated test failures and quality findings directly backward to Dev team",
      needs_revision: "Return user story back for code review revisions",
      custom: "Automated event-triggered iteration feedback loop",
    };

    setWorkflowLoops((curr) => [
      ...curr,
      {
        id,
        fromAgentId: newLoopFrom,
        toAgentId: newLoopTo,
        trigger: newLoopTrigger,
        description: newLoopDesc.trim() || defaultDescriptions[newLoopTrigger],
        maxIterations: newLoopMaxIter,
        payloadType: newLoopTrigger === "verdicts" ? "PO Critic Verdicts & Criteria" : "Vitest Test Traces & Stack",
      },
    ]);
    setShowAddLoopModal(false);
    setNewLoopDesc("");
    setNotice("Added new feedback loop!");
  };

  // Remove loop
  const removeLoop = (loopId: string) => {
    setWorkflowLoops((curr) => curr.filter((l) => l.id !== loopId));
    if (selectedLoopId === loopId) setSelectedLoopId(null);
    setNotice("Removed feedback loop.");
  };

  return (
    <div className="space-y-6">
      {/* Studio Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Workflow className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                BMad Agent & Workflow Studio
              </h2>
              <p className="text-xs text-muted-foreground">
                Design the AI team, configure models & tools, and automate bidirectional feedback loops.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Switcher (Canvas vs Flow vs Sequence) */}
          <div className="flex items-center rounded-lg border bg-muted/50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setStudioView("canvas")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
                studioView === "canvas"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Zap className="size-3.5 text-emerald-500" />
              Workflow Canvas
            </button>
            <button
              type="button"
              onClick={() => setStudioView("flow")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
                studioView === "flow"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Share2 className="size-3.5 text-primary" />
              Delivery Flow
            </button>
            <button
              type="button"
              onClick={() => setStudioView("sequence")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
                studioView === "sequence"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <GripVertical className="size-3.5" />
              Pipeline Sequence
            </button>
          </div>

          {/* Preset Buttons */}
          <div className="hidden xl:flex items-center rounded-lg border bg-muted/40 p-1 text-xs">
            <span className="px-2 text-3xs font-medium text-muted-foreground uppercase tracking-wider">Presets:</span>
            {WORKFLOW_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-foreground hover:bg-background transition-colors"
                title={p.desc}
              >
                <span>{p.icon}</span>
                <span>{p.name.split(" ")[0]}</span>
              </button>
            ))}
          </div>

          {/* Draft Save Button */}
          <Button
            size="sm"
            onClick={onDraftSave}
            disabled={busy}
            className="shadow-xs gap-1.5 font-semibold"
          >
            <Sparkles className="size-3.5" />
            Draft Workflow Change
          </Button>
        </div>
      </div>

      {notice && (
        <div className="rounded-lg border border-info/40 bg-info/10 px-4 py-2 text-xs font-medium text-info flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} className="text-info/70 hover:text-info">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Main Studio Work Area */}
      {studioView === "canvas" ? (
        <AgentWorkflowCanvas
          agents={agents}
          skills={skills}
          workflowDraft={workflowDraft}
          workflowLoops={workflowLoops}
          setWorkflowDraft={setWorkflowDraft}
          setWorkflowLoops={setWorkflowLoops}
          onSaveAgentGateway={onSaveAgentGateway}
          onSaveAgentCustomization={onSaveAgentCustomization}
          owner={owner}
          name={name}
          runtime={runtime}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* PANE 1: Left Squad & Tools Palette (col-span-3) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl border bg-card p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="size-3.5" />
                Squad & Tools
              </h3>
            </div>

            {/* Segmented Palette Tabs */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-muted/60 border border-border/50 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPaletteTab("agents")}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all",
                  paletteTab === "agents"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Bot className="size-3.5" />
                Personas ({candidateAgents.length})
              </button>
              <button
                type="button"
                onClick={() => setPaletteTab("skills")}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all",
                  paletteTab === "skills"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <BookOpen className="size-3.5" />
                Skills ({skills.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={paletteTab === "agents" ? "Search personas…" : "Search skills…"}
                value={paletteSearch}
                onChange={(e) => setPaletteSearch(e.target.value)}
                className="h-8 pl-8 text-xs bg-muted/30"
              />
            </div>

            {/* Agents Palette List */}
            {paletteTab === "agents" && (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {candidateAgents.map((agent) => {
                  const meta = getAgentMeta(agent);
                  return (
                    <div
                      key={agent.id}
                      className={cn(
                        "group flex items-center justify-between rounded-xl border p-2.5 transition-all hover:border-primary/50 hover:bg-muted/30 shadow-2xs",
                        meta.border,
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg p-1 rounded-md bg-muted/60 shrink-0">
                          {meta.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-foreground truncate">{agent.name}</p>
                          <p className="text-3xs text-muted-foreground truncate">{meta.role}</p>
                        </div>
                      </div>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6 text-muted-foreground hover:text-primary shrink-0"
                        onClick={() => addAgentToPipeline(agent.id)}
                        title="Add persona to pipeline"
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  );
                })}

                {candidateAgents.length === 0 && (
                  <p className="text-center py-4 text-xs text-muted-foreground italic">
                    All agents are currently active in the delivery pipeline.
                  </p>
                )}
              </div>
            )}

            {/* Skills Palette List */}
            {paletteTab === "skills" && (
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                <p className="text-3xs text-muted-foreground mb-1 italic">
                  💡 Drag any skill onto an agent's "Attached Skill" slot.
                </p>
                {filteredSkills.map((skill) => (
                  <div
                    key={skill.name}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/bmad-skill", skill.name);
                    }}
                    className="flex items-center justify-between rounded-lg border border-border/70 bg-card p-2 text-xs transition-all cursor-grab active:cursor-grabbing hover:border-primary/60 hover:bg-primary/5 shadow-2xs"
                    title={skill.description || skill.name}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-semibold text-foreground truncate">
                        ⚡ {skill.name}
                      </p>
                      {skill.description && (
                        <p className="text-3xs text-muted-foreground line-clamp-1 mt-0.5">
                          {skill.description}
                        </p>
                      )}
                    </div>
                    <GripVertical className="size-3.5 text-muted-foreground/60 shrink-0 ml-1.5" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PANE 2: Center Interaction Canvas (col-span-6 or 9 if drawer closed) */}
        <div className={cn(selectedAgent || selectedLoop ? "lg:col-span-6" : "lg:col-span-9", "space-y-5")}>
          {/* VIEW MODE 1: Interactive Delivery Flow with Connected Loop Bridges */}
          {studioView === "flow" && (
            <div className="space-y-5">
              {/* Flow Stages Container */}
              <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-6">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Share2 className="size-4 text-primary" />
                      Continuous Agile Delivery Pipeline ({pipelineAgents.length} Personas)
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Visual execution topology showing forward artifact handoffs and backward quality feedback loops.
                    </p>
                  </div>

                  <span className="text-3xs font-mono rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.75 text-emerald-600 dark:text-emerald-400 font-semibold">
                    {workflowLoops.length} Connected Loops
                  </span>
                </div>

                {/* Vertical / Multi-Row Phase Pipeline */}
                <div className="space-y-6">
                  {/* PHASE 1 & 2: Discovery & Product Definition */}
                  <div className="rounded-xl border border-border/70 bg-muted/10 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-sky-500" />
                        Phase 1 & 2: Requirements, Epics & Design
                      </span>
                      <span className="text-3xs text-muted-foreground">Handoff: PRD.md & User Stories</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {pipelineAgents
                        .filter((a) => {
                          const m = getAgentMeta(a);
                          return m.phaseIndex <= 2;
                        })
                        .map((agent, idx) => {
                          const loopsFrom = workflowLoops.filter((l) => l.fromAgentId === agent.id);
                          const loopsTo = workflowLoops.filter((l) => l.toAgentId === agent.id);

                          return (
                            <RichAgentCard
                              key={agent.id}
                              agent={agent}
                              index={idx}
                              total={pipelineAgents.length}
                              onSelect={() => handleSelectAgent(agent)}
                              isSelected={selectedAgentId === agent.id}
                              loopsFrom={loopsFrom}
                              loopsTo={loopsTo}
                              onDropSkill={(s) => handleRebindSkill(agent.id, s)}
                            />
                          );
                        })}
                    </div>
                  </div>

                  {/* Flow Arrow */}
                  <div className="flex items-center justify-center text-muted-foreground">
                    <div className="flex items-center gap-2 text-3xs font-mono uppercase bg-muted/50 px-3 py-1 rounded-full border border-border/60">
                      <span>Stories & Acceptance Criteria</span>
                      <span className="text-sm font-bold text-primary">↓</span>
                    </div>
                  </div>

                  {/* PHASE 3: System Architecture */}
                  {pipelineAgents.some((a) => getAgentMeta(a).phaseIndex === 3) && (
                    <div className="rounded-xl border border-border/70 bg-muted/10 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-amber-500" />
                          Phase 3: Architecture & Schemas
                        </span>
                        <span className="text-3xs text-muted-foreground">Handoff: architecture.md & Schema</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {pipelineAgents
                          .filter((a) => getAgentMeta(a).phaseIndex === 3)
                          .map((agent, idx) => {
                            const loopsFrom = workflowLoops.filter((l) => l.fromAgentId === agent.id);
                            const loopsTo = workflowLoops.filter((l) => l.toAgentId === agent.id);

                            return (
                              <RichAgentCard
                                key={agent.id}
                                agent={agent}
                                index={idx + 3}
                                total={pipelineAgents.length}
                                onSelect={() => handleSelectAgent(agent)}
                                isSelected={selectedAgentId === agent.id}
                                loopsFrom={loopsFrom}
                                loopsTo={loopsTo}
                                onDropSkill={(s) => handleRebindSkill(agent.id, s)}
                              />
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Flow Arrow */}
                  <div className="flex items-center justify-center text-muted-foreground">
                    <div className="flex items-center gap-2 text-3xs font-mono uppercase bg-muted/50 px-3 py-1 rounded-full border border-border/60">
                      <span>Architecture Spec & Data Models</span>
                      <span className="text-sm font-bold text-primary">↓</span>
                    </div>
                  </div>

                  {/* PHASE 4: Collaborative Dev & QA Iteration Container */}
                  <div className="rounded-xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                          Phase 4: Dev & QA Feedback Loop (Continuous Iteration)
                        </span>
                      </div>
                      <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-3xs font-semibold text-emerald-600 dark:text-emerald-400">
                        Closed-Loop Test Automation
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {pipelineAgents
                        .filter((a) => getAgentMeta(a).phaseIndex === 4)
                        .map((agent, idx) => {
                          const loopsFrom = workflowLoops.filter((l) => l.fromAgentId === agent.id);
                          const loopsTo = workflowLoops.filter((l) => l.toAgentId === agent.id);

                          return (
                            <RichAgentCard
                              key={agent.id}
                              agent={agent}
                              index={idx + 4}
                              total={pipelineAgents.length}
                              onSelect={() => handleSelectAgent(agent)}
                              isSelected={selectedAgentId === agent.id}
                              loopsFrom={loopsFrom}
                              loopsTo={loopsTo}
                              onDropSkill={(s) => handleRebindSkill(agent.id, s)}
                            />
                          );
                        })}
                    </div>

                    {/* Visual Loop Bridge between Amelia and Murat */}
                    <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="size-4 text-cyan-500 animate-spin-slow shrink-0" />
                        <div>
                          <p className="font-semibold text-foreground">
                            Amelia 💻 ↔ Murat 🧪 Automated Defect Loop
                          </p>
                          <p className="text-3xs text-muted-foreground">
                            Failing test assertions or regressions send stack traces directly back to Amelia for red-green-refactor fix.
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-3xs rounded bg-cyan-500/20 px-2 py-1 text-cyan-700 dark:text-cyan-300 font-semibold shrink-0">
                        Max 5 Retries
                      </span>
                    </div>
                  </div>

                  {/* Flow Arrow: Passing to PO Critic */}
                  <div className="flex items-center justify-center text-muted-foreground">
                    <div className="flex items-center gap-2 text-3xs font-mono uppercase bg-muted/50 px-3 py-1 rounded-full border border-border/60">
                      <span>Passing Tests & Working Software</span>
                      <span className="text-sm font-bold text-primary">↓</span>
                    </div>
                  </div>

                  {/* PHASE 5: PO Critic Quality Acceptance Gate */}
                  <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-rose-500" />
                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                          Phase 5: PO Critic Quality Gate (Nella)
                        </span>
                      </div>
                      <span className="rounded-full bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 text-3xs font-semibold text-rose-600 dark:text-rose-400">
                        Threshold: Score ≥ 9.0 / 10
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                      {pipelineAgents
                        .filter((a) => getAgentMeta(a).phaseIndex === 5)
                        .map((agent, idx) => {
                          const loopsFrom = workflowLoops.filter((l) => l.fromAgentId === agent.id);
                          const loopsTo = workflowLoops.filter((l) => l.toAgentId === agent.id);

                          return (
                            <RichAgentCard
                              key={agent.id}
                              agent={agent}
                              index={idx + 6}
                              total={pipelineAgents.length}
                              onSelect={() => handleSelectAgent(agent)}
                              isSelected={selectedAgentId === agent.id}
                              loopsFrom={loopsFrom}
                              loopsTo={loopsTo}
                              onDropSkill={(s) => handleRebindSkill(agent.id, s)}
                            />
                          );
                        })}

                      {/* PO Gate Decision Pathways */}
                      <div className="space-y-3">
                        {/* Green Pass Branch */}
                        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs">
                          <div className="flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-4" />
                            <span>[PASS] Score ≥ 9.0 → Sprint Complete</span>
                          </div>
                          <p className="mt-1 text-3xs text-muted-foreground">
                            All acceptance criteria fulfilled. Features tagged and ready for production release.
                          </p>
                        </div>

                        {/* Red Rejection Loop Branch */}
                        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs">
                          <div className="flex items-center gap-2 font-semibold text-rose-600 dark:text-rose-400">
                            <RotateCcw className="size-4" />
                            <span>[REJECT] Verdict Loop → Return to John / Amelia</span>
                          </div>
                          <p className="mt-1 text-3xs text-muted-foreground">
                            Critique verdict notes and acceptance gaps routed backward to refine stories and implementation.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feedback Loops & Quality Gates Management Section */}
              <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <RotateCcw className="size-4 text-rose-500" />
                      Configured Feedback Loops ({workflowLoops.length})
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Click any loop to view or edit its trigger conditions, payload data, and retry limits.
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddLoopModal(true)}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Plus className="size-3.5" />
                    Add Feedback Loop
                  </Button>
                </div>

                {/* Visual Loop Cards Grid */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {workflowLoops.map((loop) => {
                    const from = agents.find((a: any) => a.id === loop.fromAgentId);
                    const to = agents.find((a: any) => a.id === loop.toAgentId);
                    const fromMeta = getAgentMeta(from);
                    const toMeta = getAgentMeta(to);
                    const isSelected = selectedLoopId === loop.id;

                    return (
                      <div
                        key={loop.id}
                        onClick={() => handleSelectLoop(loop)}
                        className={cn(
                          "relative flex flex-col justify-between rounded-xl border p-3.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs",
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border/70 bg-muted/10 hover:border-primary/40",
                        )}
                      >
                        <div>
                          {/* Loop Header */}
                          <div className="flex items-center justify-between gap-1 pb-2 border-b border-border/40">
                            <div className="flex items-center gap-1.5 text-xs font-semibold">
                              <span className="flex items-center gap-1">
                                <span>{fromMeta.icon}</span>
                                <span className="text-foreground">{from?.name || "Evaluator"}</span>
                              </span>
                              <span className="text-primary font-bold">↺</span>
                              <span className="flex items-center gap-1">
                                <span>{toMeta.icon}</span>
                                <span className="text-foreground">{to?.name || "Receiver"}</span>
                              </span>
                            </div>

                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-6 text-muted-foreground hover:text-destructive shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeLoop(loop.id);
                              }}
                              title="Delete loop"
                            >
                              <Trash2 className="size-3" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>

                          {/* Trigger and Guardrail Badges */}
                          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider border",
                                loop.trigger === "verdicts" && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
                                loop.trigger === "findings" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
                                loop.trigger === "needs_revision" && "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
                                loop.trigger === "custom" && "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
                              )}
                            >
                              {loop.trigger}
                            </span>
                            <span className="text-3xs font-mono text-muted-foreground">
                              Limit: {loop.maxIterations || 3}x
                            </span>
                          </div>

                          {/* Description & Payload */}
                          {loop.description && (
                            <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                              {loop.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {workflowLoops.length === 0 && (
                    <div className="col-span-full rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                      No feedback loops configured. Click "Add Feedback Loop" or load a preset above to enable agile iteration.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: Horizontal DnD Sequence Track */}
          {studioView === "sequence" && (
            <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <GripVertical className="size-4 text-primary" />
                    Drag & Drop Execution Track ({pipelineAgents.length} Stages)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Drag stage handles to change execution order. Drop skills from the library directly onto cards.
                  </p>
                </div>

                <span className="text-3xs font-mono rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-primary font-medium">
                  {pipelineAgents.length} Active Personas
                </span>
              </div>

              {/* Horizontal Scrollable DnD Canvas */}
              <div className="relative overflow-x-auto pb-4 pt-1">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={workflowDraft} strategy={horizontalListSortingStrategy}>
                    <div className="flex items-center gap-3 min-w-max">
                      {pipelineAgents.map((agent: any, index: number) => {
                        const loopsFrom = workflowLoops.filter((l) => l.fromAgentId === agent.id);
                        const loopsTo = workflowLoops.filter((l) => l.toAgentId === agent.id);

                        return (
                          <div key={agent.id} className="flex items-center gap-3">
                            <SortableStageItem
                              agent={agent}
                              index={index}
                              total={pipelineAgents.length}
                              onMoveLeft={() => {
                                if (index === 0) return;
                                setWorkflowDraft((curr) => {
                                  const next = [...curr];
                                  [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                  return next;
                                });
                              }}
                              onMoveRight={() => {
                                if (index === pipelineAgents.length - 1) return;
                                setWorkflowDraft((curr) => {
                                  const next = [...curr];
                                  [next[index + 1], next[index]] = [next[index], next[index + 1]];
                                  return next;
                                });
                              }}
                              onRemove={() => removeAgentFromPipeline(agent.id)}
                              onSelect={() => handleSelectAgent(agent)}
                              isSelected={selectedAgentId === agent.id}
                              loopsFrom={loopsFrom}
                              loopsTo={loopsTo}
                              onDropSkill={(skillName) => handleRebindSkill(agent.id, skillName)}
                            />

                            {/* Forward Handoff Connector */}
                            {index < pipelineAgents.length - 1 && (
                              <div className="flex flex-col items-center justify-center text-muted-foreground/80 select-none">
                                <span className="text-lg font-bold">→</span>
                                <span className="text-3xs font-mono uppercase tracking-wider text-muted-foreground/60">handoff</span>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Drop Target zone */}
                      <div
                        onDragOver={(e) => {
                          if (e.dataTransfer.types.includes("application/bmad-agent")) {
                            e.preventDefault();
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const agentId = e.dataTransfer.getData("application/bmad-agent");
                          if (agentId) addAgentToPipeline(agentId);
                        }}
                        className="flex h-56 w-44 shrink-0 flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-center transition-colors hover:border-primary/50 hover:bg-muted/40"
                      >
                        <Plus className="size-6 text-muted-foreground/70 mb-1" />
                        <p className="text-xs font-medium text-foreground">Drop Agent Here</p>
                        <p className="text-3xs text-muted-foreground mt-0.5">or choose from palette</p>
                      </div>
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          )}
        </div>

        {/* PANE 3: Contextual Right Inspector Drawer (col-span-3) */}
        {(selectedAgent || selectedLoop) && (
          <div className="lg:col-span-3 space-y-4 sticky top-4 self-start">
            {/* AGENT INSPECTOR */}
            {selectedAgent && agentForm && (
              <div className="rounded-2xl border border-primary/40 bg-card p-4 shadow-md space-y-4">
                <div className="flex items-center justify-between border-b pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xl p-1 rounded-md bg-muted/60">{agentForm.icon}</span>
                    <div className="min-w-0">
                      <h3 className="text-xs font-semibold text-foreground truncate">
                        {agentForm.name}
                      </h3>
                      <p className="text-3xs text-muted-foreground truncate">{agentForm.title}</p>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedAgentId(null)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>

                {/* Sub-Tabs: Model vs Persona */}
                <div className="grid grid-cols-2 p-1 rounded-lg bg-muted/50 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setInspectorTab("model")}
                    className={cn(
                      "py-1 rounded text-center transition-colors",
                      inspectorTab === "model" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground",
                    )}
                  >
                    Model & Route
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorTab("persona")}
                    className={cn(
                      "py-1 rounded text-center transition-colors",
                      inspectorTab === "persona" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground",
                    )}
                  >
                    Persona & Prompts
                  </button>
                </div>

                {/* TAB 1: MODEL & GATEWAY ROUTE */}
                {inspectorTab === "model" && (
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-3xs font-medium text-foreground block mb-1">
                        Inference Route / Provider
                      </label>
                      <select
                        className="h-8 w-full rounded-md border bg-background px-2.5 text-xs font-medium"
                        value={agentForm.route}
                        onChange={(e) => {
                          const r = e.target.value;
                          const defaults: Record<string, { url: string; model: string }> = {
                            agy: { url: "http://host.docker.internal:3005/v1", model: "gemini-3.8-flash-high" },
                            gemini: { url: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.0-flash" },
                            openai: { url: "https://api.openai.com/v1", model: "gpt-4o" },
                            openrouter: { url: "https://openrouter.ai/api/v1", model: "anthropic/claude-3.7-sonnet" },
                            ollama: { url: "http://localhost:11434/v1", model: "qwen2.5-coder:latest" },
                            "lm-studio": { url: "http://localhost:1234/v1", model: "local-model" },
                          };
                          setAgentForm({
                            ...agentForm,
                            route: r,
                            gatewayBaseUrl: r === "project" ? "" : defaults[r]?.url || agentForm.gatewayBaseUrl,
                            gatewayModel: r === "project" ? "" : defaults[r]?.model || agentForm.gatewayModel,
                          });
                        }}
                      >
                        <option value="project">Project Default Gateway (Antigravity Gemini 3.8 Flash)</option>
                        <option value="agy">⚡ Antigravity (AGY Subscription - Gemini 3.8 Flash)</option>
                        <option value="gemini">🌟 Google Gemini (Direct API)</option>
                        <option value="openai">🤖 OpenAI / Codex API</option>
                        <option value="openrouter">🌐 OpenRouter</option>
                        <option value="ollama">🦙 Ollama (Local / Fast)</option>
                        <option value="lm-studio">💻 LM Studio (Local)</option>
                        <option value="custom">⚙️ Custom Compatible Endpoint</option>
                      </select>
                    </div>

                    {agentForm.route === "agy" && (
                      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-3xs text-emerald-600 dark:text-emerald-400">
                        ⚡ <strong>Antigravity Subscription Active:</strong> Uses your logged-in Google Antigravity account directly through the AGY bridge. No API key needed.
                      </div>
                    )}

                    {agentForm.route === "project" && (
                      <div className="rounded-lg bg-muted/50 border border-border/60 p-2 text-3xs text-muted-foreground">
                        ℹ️ <strong>Inherits Project Gateway:</strong> By default, all agents route through your Antigravity subscription with Gemini 3.8 Flash. You can customize the project gateway anytime in Project Settings.
                      </div>
                    )}

                    {agentForm.route !== "project" && (
                      <>
                        <div>
                          <label className="text-3xs font-medium text-foreground block mb-1">
                            Endpoint Base URL
                          </label>
                          <Input
                            className="h-8 text-xs font-mono"
                            value={agentForm.gatewayBaseUrl}
                            onChange={(e) => setAgentForm({ ...agentForm, gatewayBaseUrl: e.target.value })}
                            placeholder="https://api.openai.com/v1"
                          />
                        </div>

                        <div>
                          <label className="text-3xs font-medium text-foreground block mb-1">
                            Model ID
                          </label>
                          <Input
                            className="h-8 text-xs font-mono font-semibold"
                            value={agentForm.gatewayModel}
                            onChange={(e) => setAgentForm({ ...agentForm, gatewayModel: e.target.value })}
                            placeholder="gemini-3.8-flash-high"
                          />

                          {/* Quick Model Chips */}
                          <div className="mt-2 space-y-1">
                            <span className="text-3xs text-muted-foreground block font-medium">Quick Model Presets:</span>
                            <div className="flex flex-wrap gap-1">
                              {agentForm.route === "agy" && (
                                <>
                                  {[
                                    { id: "gemini-3.8-flash-high", label: "Gemini 3.8 Flash (High)", desc: "High reasoning" },
                                    { id: "gemini-3.8-flash-medium", label: "Gemini 3.8 Flash (Med)", desc: "Balanced" },
                                    { id: "gemini-3.8-flash-low", label: "Gemini 3.8 Flash (Low)", desc: "Ultra-fast" },
                                    { id: "gemini-3.7-flash-high", label: "Gemini 3.7 Flash", desc: "Stable flash" },
                                    { id: "gemini-3.1-pro-high", label: "Gemini 3.1 Pro", desc: "Deep reasoning" },
                                    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", desc: "Thinking" },
                                    { id: "claude-opus-4-6-thinking", label: "Claude Opus 4.6", desc: "Deep thinking" },
                                  ].map((m) => (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => setAgentForm({ ...agentForm, gatewayModel: m.id })}
                                      className={cn(
                                        "px-2 py-0.5 rounded text-3xs font-mono border transition-colors",
                                        agentForm.gatewayModel === m.id
                                          ? "bg-primary text-primary-foreground border-primary font-bold"
                                          : "bg-muted/60 hover:bg-muted text-foreground border-border/60"
                                      )}
                                      title={m.desc}
                                    >
                                      {m.label}
                                    </button>
                                  ))}
                                </>
                              )}

                              {agentForm.route === "gemini" && (
                                <>
                                  {["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-pro"].map((m) => (
                                    <button
                                      key={m}
                                      type="button"
                                      onClick={() => setAgentForm({ ...agentForm, gatewayModel: m })}
                                      className={cn(
                                        "px-2 py-0.5 rounded text-3xs font-mono border transition-colors",
                                        agentForm.gatewayModel === m
                                          ? "bg-primary text-primary-foreground border-primary font-bold"
                                          : "bg-muted/60 hover:bg-muted text-foreground border-border/60"
                                      )}
                                    >
                                      {m}
                                    </button>
                                  ))}
                                </>
                              )}

                              {agentForm.route === "openai" && (
                                <>
                                  {["gpt-4o", "gpt-4o-mini", "o3-mini", "o1"].map((m) => (
                                    <button
                                      key={m}
                                      type="button"
                                      onClick={() => setAgentForm({ ...agentForm, gatewayModel: m })}
                                      className={cn(
                                        "px-2 py-0.5 rounded text-3xs font-mono border transition-colors",
                                        agentForm.gatewayModel === m
                                          ? "bg-primary text-primary-foreground border-primary font-bold"
                                          : "bg-muted/60 hover:bg-muted text-foreground border-border/60"
                                      )}
                                    >
                                      {m}
                                    </button>
                                  ))}
                                </>
                              )}

                              {agentForm.route === "openrouter" && (
                                <>
                                  {["anthropic/claude-3.7-sonnet", "deepseek/deepseek-r1", "google/gemini-2.0-flash-001"].map((m) => (
                                    <button
                                      key={m}
                                      type="button"
                                      onClick={() => setAgentForm({ ...agentForm, gatewayModel: m })}
                                      className={cn(
                                        "px-2 py-0.5 rounded text-3xs font-mono border transition-colors",
                                        agentForm.gatewayModel === m
                                          ? "bg-primary text-primary-foreground border-primary font-bold"
                                          : "bg-muted/60 hover:bg-muted text-foreground border-border/60"
                                      )}
                                    >
                                      {m}
                                    </button>
                                  ))}
                                </>
                              )}

                              {agentForm.route === "ollama" && (
                                <>
                                  {["qwen2.5-coder:latest", "llama3.3:latest", "deepseek-r1:latest"].map((m) => (
                                    <button
                                      key={m}
                                      type="button"
                                      onClick={() => setAgentForm({ ...agentForm, gatewayModel: m })}
                                      className={cn(
                                        "px-2 py-0.5 rounded text-3xs font-mono border transition-colors",
                                        agentForm.gatewayModel === m
                                          ? "bg-primary text-primary-foreground border-primary font-bold"
                                          : "bg-muted/60 hover:bg-muted text-foreground border-border/60"
                                      )}
                                    >
                                      {m}
                                    </button>
                                  ))}
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {agentForm.route !== "agy" && (
                          <div>
                            <label className="text-3xs font-medium text-foreground block mb-1">
                              API Key {agentForm.route === "ollama" || agentForm.route === "lm-studio" ? "(optional for local)" : "(required for cloud API)"}
                            </label>
                            <Input
                              type="password"
                              className="h-8 text-xs font-mono"
                              value={agentForm.apiKey}
                              onChange={(e) => setAgentForm({ ...agentForm, apiKey: e.target.value })}
                              placeholder={selectedAgent.gatewayKeyConfigured ? "Saved — enter to replace" : "API Key"}
                            />
                          </div>
                        )}
                      </>
                    )}

                    <Button
                      size="sm"
                      className="w-full text-xs font-semibold gap-1.5 mt-2"
                      disabled={busy}
                      onClick={handleSaveModelRoute}
                    >
                      <KeyRound className="size-3.5" />
                      Save Model Route
                    </Button>
                  </div>
                )}

                {/* TAB 2: PERSONA & INSTRUCTIONS */}
                {inspectorTab === "persona" && (
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-3xs font-medium text-foreground block mb-1">
                        Display Name & Title
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          className="h-8 text-xs"
                          value={agentForm.name}
                          onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                        />
                        <Input
                          className="h-8 text-xs"
                          value={agentForm.title}
                          onChange={(e) => setAgentForm({ ...agentForm, title: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-3xs font-medium text-foreground block mb-1">
                        Assigned Skill
                      </label>
                      <select
                        className="h-8 w-full rounded-md border bg-background px-2.5 text-xs font-mono"
                        value={agentForm.skillName}
                        onChange={(e) => setAgentForm({ ...agentForm, skillName: e.target.value })}
                      >
                        {skills.map((s) => (
                          <option key={s.name} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-3xs font-medium text-foreground block mb-1">
                        Communication Style & Identity
                      </label>
                      <Textarea
                        className="min-h-16 text-xs"
                        value={agentForm.description}
                        onChange={(e) => setAgentForm({ ...agentForm, description: e.target.value })}
                        placeholder="Communication style and tone"
                      />
                    </div>

                    <div>
                      <label className="text-3xs font-medium text-foreground block mb-1">
                        Persona Instructions & Activation Hooks
                      </label>
                      <Textarea
                        className="min-h-24 text-2xs font-mono"
                        value={agentForm.persona}
                        onChange={(e) => setAgentForm({ ...agentForm, persona: e.target.value })}
                        placeholder="Persona instructions and persistent facts"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={agentForm.scope === "personal"}
                        onChange={(e) => setAgentForm({ ...agentForm, scope: e.target.checked ? "personal" : "team" })}
                      />
                      Personal override (.user.toml)
                    </label>

                    <Button
                      size="sm"
                      className="w-full text-xs font-semibold gap-1.5 mt-2"
                      disabled={busy}
                      onClick={handleSaveAgentCustomization}
                    >
                      <Sparkles className="size-3.5" />
                      Draft Persona Customization
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* LOOP INSPECTOR */}
            {selectedLoop && (
              <div className="rounded-2xl border border-rose-500/40 bg-card p-4 shadow-md space-y-4">
                <div className="flex items-center justify-between border-b pb-2.5">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="size-4 text-rose-500" />
                    <div>
                      <h3 className="text-xs font-semibold text-foreground">Loop Inspector</h3>
                      <p className="text-3xs text-muted-foreground">{selectedLoop.trigger} protocol</p>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedLoopId(null)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-3xs text-muted-foreground font-medium">Loop Pathway:</span>
                    <p className="font-semibold text-xs mt-0.5 text-foreground flex items-center gap-1.5">
                      <span>{agents.find((a) => a.id === selectedLoop.fromAgentId)?.name || "Evaluator"}</span>
                      <span className="text-primary font-bold">↺</span>
                      <span>{agents.find((a) => a.id === selectedLoop.toAgentId)?.name || "Receiver"}</span>
                    </p>
                  </div>

                  <div>
                    <span className="text-3xs text-muted-foreground font-medium">Trigger Type:</span>
                    <p className="font-mono text-xs uppercase text-foreground bg-muted/40 p-1.5 rounded mt-0.5">
                      {selectedLoop.trigger}
                    </p>
                  </div>

                  <div>
                    <span className="text-3xs text-muted-foreground font-medium">Iteration Guardrail:</span>
                    <p className="text-xs text-foreground bg-muted/40 p-1.5 rounded mt-0.5">
                      Max {selectedLoop.maxIterations || 3} iterations before escalating to human review
                    </p>
                  </div>

                  {selectedLoop.description && (
                    <div>
                      <span className="text-3xs text-muted-foreground font-medium">Protocol Notes:</span>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                        {selectedLoop.description}
                      </p>
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full text-xs font-semibold gap-1.5 mt-2"
                    onClick={() => removeLoop(selectedLoop.id)}
                  >
                    <Trash2 className="size-3.5" />
                    Delete Loop
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Add Feedback Loop Modal */}
      {showAddLoopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border bg-card p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <RotateCcw className="size-4 text-primary" />
                  Configure Feedback Loop & Quality Gate
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Route review verdicts or QA findings backward to an upstream agent for rework.
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={() => setShowAddLoopModal(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-foreground">From Evaluator (Source)</label>
                <select
                  className="mt-1 h-9 w-full rounded-md border bg-background px-2.5 text-xs"
                  value={newLoopFrom}
                  onChange={(e) => setNewLoopFrom(e.target.value)}
                >
                  <option value="">Select source agent…</option>
                  {pipelineAgents.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.icon} {a.name} ({getAgentMeta(a).role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">To Receiver (Target)</label>
                <select
                  className="mt-1 h-9 w-full rounded-md border bg-background px-2.5 text-xs"
                  value={newLoopTo}
                  onChange={(e) => setNewLoopTo(e.target.value)}
                >
                  <option value="">Select target agent…</option>
                  {pipelineAgents.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.icon} {a.name} ({getAgentMeta(a).role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground">Trigger Protocol</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                {(["verdicts", "findings", "needs_revision", "custom"] as const).map((trig) => (
                  <button
                    key={trig}
                    type="button"
                    onClick={() => setNewLoopTrigger(trig)}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 text-xs font-medium text-center transition-colors capitalize",
                      newLoopTrigger === trig
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border hover:bg-muted text-muted-foreground",
                    )}
                  >
                    {trig.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground">Max Loop Iterations</label>
                <select
                  className="mt-1 h-9 w-full rounded-md border bg-background px-2.5 text-xs"
                  value={newLoopMaxIter}
                  onChange={(e) => setNewLoopMaxIter(Number(e.target.value))}
                >
                  <option value={2}>2 iterations</option>
                  <option value={3}>3 iterations (recommended)</option>
                  <option value={5}>5 iterations (code/test fix)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Circuit Breaker</label>
                <p className="mt-2 text-2xs text-muted-foreground">
                  Escalates to human reviewer if iterations exceed limit.
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground">Description & Iteration Notes</label>
              <Input
                className="mt-1 h-9 text-xs"
                placeholder="e.g. Pass PO verdicts back to John to write prioritized user stories"
                value={newLoopDesc}
                onChange={(e) => setNewLoopDesc(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddLoopModal(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!newLoopFrom || !newLoopTo || newLoopFrom === newLoopTo}
                onClick={handleAddLoop}
              >
                Add Loop
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
