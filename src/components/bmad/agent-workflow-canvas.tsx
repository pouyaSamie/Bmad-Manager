/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Settings2,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
  Plus,
  X,
  Check,
  Cpu,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Sliders,
  ExternalLink,
  ShieldCheck,
  Flame,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ROLE_META_MAP, getAgentMeta, type WorkflowLoop } from "./workflow-types";

type CanvasNode = {
  id: string;
  type: "trigger" | "agent" | "release";
  name: string;
  subtitle: string;
  icon: string;
  color: string;
  agent?: any;
  defaultX: number;
  defaultY: number;
};

type Connection = {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
  isLoop?: boolean;
  loopTrigger?: string;
  color?: string;
};

type Props = {
  agents: any[];
  skills: any[];
  workflowDraft: string[];
  workflowLoops: WorkflowLoop[];
  setWorkflowDraft: React.Dispatch<React.SetStateAction<string[]>>;
  setWorkflowLoops: React.Dispatch<React.SetStateAction<WorkflowLoop[]>>;
  onSaveAgentGateway?: (payload: any) => Promise<any>;
  onSaveAgentCustomization?: (payload: any) => Promise<any>;
  owner?: string;
  name?: string;
  runtime?: any;
};

export function AgentWorkflowCanvas({
  agents,
  skills,
  workflowDraft,
  workflowLoops,
  setWorkflowDraft,
  setWorkflowLoops,
  onSaveAgentGateway,
  onSaveAgentCustomization,
  owner,
  name,
  runtime,
}: Props) {
  // Zoom & Pan (Framed to fit all 8 nodes on screen by default)
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 20, y: 30 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Dragging Node state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Custom node positions
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});

  // Selection & Configuration Modal
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [configAgent, setConfigAgent] = useState<any | null>(null);
  const [configTab, setConfigTab] = useState<"model" | "persona" | "skill">("model");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Config Form State
  const [formRoute, setFormRoute] = useState("project");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [formModel, setFormModel] = useState("gemini-3.8-flash-high");
  const [formApiKey, setFormApiKey] = useState("");
  const [formName, setFormName] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formIcon, setFormIcon] = useState("");
  const [formPersona, setFormPersona] = useState("");
  const [formSkill, setFormSkill] = useState("");
  const [formScope, setFormScope] = useState<"team" | "personal">("team");
  const [saveNotice, setSaveNotice] = useState("");

  // Map agents in pipeline order
  const pipelineAgents = useMemo(() => {
    return workflowDraft
      .map((id) => agents.find((a) => a.id === id))
      .filter(Boolean);
  }, [workflowDraft, agents]);

  // Canonical graph layout positions (Optimized for full pipeline visibility)
  const defaultPositions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {
      trigger: { x: 30, y: 220 },
    };

    pipelineAgents.forEach((agent) => {
      const k = `${agent.name || ""} ${agent.slug || ""}`.toLowerCase();
      if (k.includes("mary") || k.includes("analyst")) {
        pos[agent.id] = { x: 210, y: 220 };
      } else if (k.includes("john") || k.includes("pm")) {
        pos[agent.id] = { x: 450, y: 90 };
      } else if (k.includes("sally") || k.includes("ux")) {
        pos[agent.id] = { x: 450, y: 340 };
      } else if (k.includes("winston") || k.includes("architect")) {
        pos[agent.id] = { x: 690, y: 220 };
      } else if (k.includes("amelia") || k.includes("dev")) {
        pos[agent.id] = { x: 930, y: 90 };
      } else if (k.includes("murat") || k.includes("tea") || k.includes("qa")) {
        pos[agent.id] = { x: 930, y: 340 };
      } else if (k.includes("nella") || k.includes("po") || k.includes("critic")) {
        pos[agent.id] = { x: 1170, y: 220 };
      } else {
        const idx = pipelineAgents.indexOf(agent);
        pos[agent.id] = { x: 230 + idx * 220, y: 220 };
      }
    });

    pos["release"] = { x: 1410, y: 220 };
    return pos;
  }, [pipelineAgents]);

  const getNodePos = (id: string) => {
    return nodePositions[id] || defaultPositions[id] || { x: 100, y: 100 };
  };

  // Build Connections
  const connections = useMemo(() => {
    const list: Connection[] = [];
    const findAgent = (q: string) =>
      pipelineAgents.find((a) => `${a.name || ""} ${a.slug || ""}`.toLowerCase().includes(q));

    const mary = findAgent("mary") || findAgent("analyst");
    const john = findAgent("john") || findAgent("pm");
    const sally = findAgent("sally") || findAgent("ux");
    const winston = findAgent("winston") || findAgent("architect");
    const amelia = findAgent("amelia") || findAgent("dev");
    const murat = findAgent("murat") || findAgent("tea") || findAgent("qa");
    const nella = findAgent("nella") || findAgent("po");

    // 1. Trigger -> First Agent (or Mary)
    if (mary) {
      list.push({ id: "trig-mary", fromId: "trigger", toId: mary.id, label: "Sprint Brief" });
    } else if (pipelineAgents[0]) {
      list.push({ id: `trig-${pipelineAgents[0].id}`, fromId: "trigger", toId: pipelineAgents[0].id });
    }

    // 2. Mary -> John (PM) and Sally (UX)
    if (mary && john) {
      list.push({ id: "mary-john", fromId: mary.id, toId: john.id, label: "PRD" });
    }
    if (mary && sally) {
      list.push({ id: "mary-sally", fromId: mary.id, toId: sally.id, label: "User Flows" });
    }

    // 3. John & Sally -> Winston (Architect)
    if (john && winston) {
      list.push({ id: "john-winston", fromId: john.id, toId: winston.id, label: "Epics & Stories" });
    }
    if (sally && winston) {
      list.push({ id: "sally-winston", fromId: sally.id, toId: winston.id, label: "Design Specs" });
    }

    // 4. Winston -> Amelia (Dev)
    if (winston && amelia) {
      list.push({ id: "winston-amelia", fromId: winston.id, toId: amelia.id, label: "Architecture & Schema" });
    }

    // 5. Amelia -> Murat (QA)
    if (amelia && murat) {
      list.push({ id: "amelia-murat", fromId: amelia.id, toId: murat.id, label: "Pull Request & Code" });
    }

    // 6. Murat -> Nella (PO Critic)
    if (murat && nella) {
      list.push({ id: "murat-nella", fromId: murat.id, toId: nella.id, label: "Passing Tests" });
    }

    // 7. Nella -> Release
    if (nella) {
      list.push({ id: "nella-release", fromId: nella.id, toId: "release", label: "Accepted (Score >= 9.0)" });
    }

    // Feedback Loops (Bidirectional Cables)
    workflowLoops.forEach((loop) => {
      list.push({
        id: `loop-${loop.id}`,
        fromId: loop.fromAgentId,
        toId: loop.toAgentId,
        isLoop: true,
        loopTrigger: loop.trigger,
        label: loop.trigger === "verdicts" ? "PO Critic Verdict Loop" : loop.trigger === "findings" ? "QA Defect Loop" : "Revision Loop",
        color: loop.trigger === "verdicts" ? "#f43f5e" : loop.trigger === "findings" ? "#06b6d4" : "#f59e0b",
      });
    });

    return list;
  }, [pipelineAgents, workflowLoops]);

  // Open Configuration Modal for an Agent
  const handleOpenConfig = useCallback((agent: any) => {
    setConfigAgent(agent);
    setSelectedNodeId(agent.id);
    setConfigTab("model");
    setTestResult(null);
    setSaveNotice("");

    const meta = getAgentMeta(agent);
    setFormRoute(
      agent.providerLabel === "Antigravity (AGY)"
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
    );
    setFormBaseUrl(agent.gatewayBaseUrl || (runtime?.gatewayBaseUrl || "http://host.docker.internal:3005/v1"));
    setFormModel(agent.gatewayModel || meta.defaultModel);
    setFormApiKey("");
    setFormName(agent.name);
    setFormTitle(agent.title || meta.role);
    setFormIcon(agent.icon || meta.icon);
    // Prepopulate rich default BMad persona if empty
    setFormPersona(agent.persona || meta.defaultPersona);
    setFormSkill(agent.skillName || agent.slug || "bmad-agent-analyst");
    setFormScope(agent.scope === "personal" ? "personal" : "team");
  }, [runtime]);

  // Save Configuration from Modal
  const handleSaveConfig = async () => {
    if (!configAgent) return;
    setIsSavingConfig(true);
    setSaveNotice("");
    try {
      if (onSaveAgentGateway) {
        await onSaveAgentGateway({
          agentId: configAgent.id,
          route: formRoute,
          gatewayBaseUrl: formRoute === "project" ? undefined : formBaseUrl,
          gatewayModel: formRoute === "project" ? undefined : formModel,
          apiKey: formApiKey || undefined,
        });
      }

      if (onSaveAgentCustomization) {
        await onSaveAgentCustomization({
          agentId: configAgent.id,
          scope: formScope,
          data: {
            name: formName,
            title: formTitle,
            icon: formIcon,
            persona: formPersona,
            skill: formSkill,
          },
        });
      }

      setSaveNotice("Configuration saved successfully!");
      setTimeout(() => {
        setSaveNotice("");
        setConfigAgent(null);
      }, 1200);
    } catch (err: any) {
      setSaveNotice(`Failed to save: ${err?.message || "Unknown error"}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Test Run Node
  const handleTestNode = async () => {
    if (!configAgent) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/bmad/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          name,
          agentId: configAgent.id,
          message: "Status check: Output your role, active model, and confirmation that you are ready for the sprint.",
        }),
      });

      if (!res.ok) {
        setTestResult(`Gateway responded with status ${res.status}. Check endpoint configuration.`);
      } else {
        const text = await res.text();
        setTestResult(text.slice(0, 300) || "Test completed successfully.");
      }
    } catch (e: any) {
      setTestResult(`Test execution error: ${e.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  // Canvas Mouse Events for Panning
  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".canvas-node")) return;
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      });
    } else if (draggingNodeId) {
      const newX = Math.max(20, e.clientX - dragOffsetRef.current.x);
      const newY = Math.max(20, e.clientY - dragOffsetRef.current.y);
      setNodePositions((prev) => ({
        ...prev,
        [draggingNodeId]: { x: newX, y: newY },
      }));
    }
  };

  const handleMouseUpCanvas = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  // Node Dragging Start
  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedNodeId(id);
    setDraggingNodeId(id);
    const pos = getNodePos(id);
    dragOffsetRef.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
  };

  // Reset to Auto Layout
  const resetLayout = () => {
    setNodePositions({});
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="space-y-4">
      {/* Canvas Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 shadow-md text-zinc-200">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <Zap className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Agent Workflow Canvas
              <span className="text-3xs px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-mono">
                Interactive Graph
              </span>
            </h3>
            <p className="text-3xs text-zinc-400">
              Double-click any node or click <span className="font-semibold text-zinc-200">⚙️ Config</span> to configure model, persona, and gateway routes.
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
              className="p-1.5 hover:text-white text-zinc-400 hover:bg-zinc-800 rounded transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="size-3.5" />
            </button>
            <span className="px-2 text-3xs font-mono font-semibold text-zinc-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.8, z + 0.1))}
              className="p-1.5 hover:text-white text-zinc-400 hover:bg-zinc-800 rounded transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="size-3.5" />
            </button>
            <button
              onClick={resetLayout}
              className="px-2 py-1 text-3xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors border-l border-zinc-800"
              title="Reset Zoom & Auto Layout"
            >
              Reset
            </button>
          </div>

          {/* Quick Active Default Info */}
          <div className="hidden md:flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-3xs">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-zinc-400">Active Engine:</span>
            <span className="font-mono font-semibold text-white">AGY Gemini 3.8 Flash</span>
          </div>
        </div>
      </div>

      {/* Canvas Viewport (Dark dot grid) */}
      <div
        ref={canvasRef}
        onMouseDown={handleMouseDownCanvas}
        onMouseMove={handleMouseMoveCanvas}
        onMouseUp={handleMouseUpCanvas}
        className={cn(
          "relative w-full h-[680px] rounded-2xl border-2 border-zinc-800 bg-zinc-950 overflow-hidden select-none cursor-grab",
          isPanning && "cursor-grabbing",
        )}
        style={{
          backgroundImage: "radial-gradient(circle, #27272a 1.2px, transparent 1.2px)",
          backgroundSize: "28px 28px",
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {/* Transformable Canvas Layer */}
        <div
          className="absolute inset-0 origin-top-left transition-transform duration-75"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* SVG Cable Connectors Layer */}
          <svg
            className="absolute top-0 left-0 w-[2400px] h-[1600px] pointer-events-none"
            style={{ overflow: "visible" }}
          >
            <defs>
              {/* Forward Arrow Marker */}
              <marker
                id="bmad-arrow-forward"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#71717a" />
              </marker>

              {/* Loop Arrow Marker (Cyan) */}
              <marker
                id="bmad-arrow-loop-cyan"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#06b6d4" />
              </marker>

              {/* Loop Arrow Marker (Rose) */}
              <marker
                id="bmad-arrow-loop-rose"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#f43f5e" />
              </marker>

              {/* Gradient for forward lines */}
              <linearGradient id="bmad-line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#52525b" />
                <stop offset="100%" stopColor="#a1a1aa" />
              </linearGradient>
            </defs>

            {connections.map((conn) => {
              const fromPos = getNodePos(conn.fromId);
              const toPos = getNodePos(conn.toId);

              const isTrigger = conn.fromId === "trigger";
              const isRelease = conn.toId === "release";

              const x1 = isTrigger ? fromPos.x + 176 : fromPos.x + 224;
              const y1 = isTrigger ? fromPos.y + 36 : fromPos.y + 50;

              const x2 = toPos.x;
              const y2 = isRelease ? toPos.y + 36 : toPos.y + 50;

              // Dedicated loop paths to eliminate collision with intermediate nodes
              if (conn.isLoop) {
                // PO Critic Verdict Loop arches high overhead to clear all middle agents!
                if (conn.loopTrigger === "verdicts") {
                  const startX = fromPos.x + 112;
                  const startY = fromPos.y; // top of Nella
                  const endX = toPos.x + 112;
                  const endY = toPos.y; // top of John
                  const overheadY = -40; // High in the overhead sky
                  const pathData = `M ${startX} ${startY} C ${startX} ${overheadY}, ${endX} ${overheadY}, ${endX} ${endY}`;
                  const labelX = (startX + endX) / 2;
                  const labelY = overheadY + 14;

                  return (
                    <g key={conn.id}>
                      <path
                        d={pathData}
                        fill="none"
                        stroke={conn.color || "#f43f5e"}
                        strokeWidth={2.5}
                        strokeDasharray="6 4"
                        markerEnd="url(#bmad-arrow-loop-rose)"
                        className="opacity-90"
                      />
                      {conn.label && (
                        <text
                          x={labelX}
                          y={labelY}
                          fill={conn.color || "#f43f5e"}
                          fontSize="10"
                          fontFamily="monospace"
                          fontWeight="600"
                          textAnchor="middle"
                          className="select-none"
                        >
                          ↩ {conn.label}
                        </text>
                      )}
                    </g>
                  );
                }

                // QA Defect Loop arches underneath to clear Sally and lower tier forward lines!
                const startX = fromPos.x + 112;
                const startY = fromPos.y + 100; // bottom of Murat
                const endX = toPos.x + 112;
                const endY = toPos.y + 100; // bottom of target
                const underY = 480; // Below lower tier
                const pathData = `M ${startX} ${startY} C ${startX} ${underY}, ${endX} ${underY}, ${endX} ${endY}`;
                const labelX = (startX + endX) / 2;
                const labelY = underY - 8;

                return (
                  <g key={conn.id}>
                    <path
                      d={pathData}
                      fill="none"
                      stroke={conn.color || "#06b6d4"}
                      strokeWidth={2.5}
                      strokeDasharray="6 4"
                      markerEnd="url(#bmad-arrow-loop-cyan)"
                      className="opacity-90"
                    />
                    {conn.label && (
                      <text
                        x={labelX}
                        y={labelY}
                        fill={conn.color || "#06b6d4"}
                        fontSize="10"
                        fontFamily="monospace"
                        fontWeight="600"
                        textAnchor="middle"
                        className="select-none"
                      >
                        ↩ {conn.label}
                      </text>
                    )}
                  </g>
                );
              }

              // Standard forward S-curve
              const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
              const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

              return (
                <g key={conn.id}>
                  <path
                    d={pathData}
                    fill="none"
                    stroke="#27272a"
                    strokeWidth={5}
                  />
                  <path
                    d={pathData}
                    fill="none"
                    stroke="url(#bmad-line-grad)"
                    strokeWidth={2}
                    markerEnd="url(#bmad-arrow-forward)"
                  />
                  <circle r={3} fill="#38bdf8">
                    <animateMotion
                      path={pathData}
                      dur="3s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  {conn.label && (
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2 - 8}
                      fill="#71717a"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                      className="select-none"
                    >
                      {conn.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* 1. START TRIGGER NODE (Unified Stadium Card) */}
          {(() => {
            const pos = getNodePos("trigger");
            const isSelected = selectedNodeId === "trigger";

            return (
              <div
                className="canvas-node absolute group cursor-grab active:cursor-grabbing select-none"
                style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
                onMouseDown={(e) => handleNodeMouseDown(e, "trigger")}
                onClick={() => setSelectedNodeId("trigger")}
              >
                <div
                  className={cn(
                    "relative flex items-center justify-between w-44 rounded-2xl border-2 bg-zinc-900/95 p-3 shadow-xl transition-all",
                    isSelected ? "border-emerald-400 ring-2 ring-emerald-500/30" : "border-zinc-700 hover:border-zinc-500",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="size-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-xl shadow-inner">
                      🕒
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white tracking-tight">Run Sprint</p>
                      <p className="text-3xs text-emerald-400 font-mono">active trigger</p>
                    </div>
                  </div>

                  <div
                    className="absolute -right-2 top-1/2 -translate-y-1/2 size-4 rounded-full bg-zinc-200 border-2 border-zinc-900 shadow-sm"
                    title="Output Port: Triggers sprint kickoff"
                  />
                </div>
              </div>
            );
          })()}

          {/* 2. AGENT ACTION NODES (Unified Cohesive Cards) */}
          {pipelineAgents.map((agent) => {
            const pos = getNodePos(agent.id);
            const meta = getAgentMeta(agent);
            const isSelected = selectedNodeId === agent.id;
            const modelLabel = agent.gatewayConfigured
              ? agent.gatewayModel
              : "gemini-3.8-flash-high";

            return (
              <div
                key={agent.id}
                className="canvas-node absolute group cursor-grab active:cursor-grabbing select-none"
                style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
                onMouseDown={(e) => handleNodeMouseDown(e, agent.id)}
                onClick={() => setSelectedNodeId(agent.id)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleOpenConfig(agent);
                }}
              >
                <div
                  className={cn(
                    "relative flex flex-col justify-between w-56 rounded-2xl border-2 bg-zinc-900/95 p-3 shadow-2xl transition-all duration-150 backdrop-blur-xs",
                    isSelected
                      ? "border-primary ring-3 ring-primary/40 bg-zinc-900 shadow-primary/20"
                      : "border-zinc-700/80 hover:border-zinc-500 hover:shadow-zinc-800/50",
                  )}
                >
                  {/* Top Color Accent Line */}
                  <div className={cn("absolute -top-0.5 inset-x-4 h-1 rounded-full", meta.accent)} />

                  {/* Header Row: Provider Route Pill + Config Button */}
                  <div className="flex items-center justify-between w-full mb-1.5">
                    <div className="flex items-center gap-1.5 rounded-full px-2 py-0.5 bg-zinc-800/90 border border-zinc-700/70 text-4xs font-mono text-zinc-300">
                      <span className={cn("size-1.5 rounded-full", agent.gatewayConfigured ? "bg-amber-400" : "bg-emerald-400 animate-pulse")} />
                      <span>{agent.gatewayConfigured ? "Custom" : "AGY Gemini 3.8"}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenConfig(agent);
                      }}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-800 hover:bg-primary text-zinc-300 hover:text-white border border-zinc-700 text-3xs font-medium transition-all shadow-xs"
                      title="Configure node (or double click)"
                    >
                      <Settings2 className="size-3" />
                      <span>Config</span>
                    </button>
                  </div>

                  {/* Identity Row: Icon + Name & Title */}
                  <div className="flex items-center gap-2.5 my-1">
                    <div
                      className={cn(
                        "size-10 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-inner border",
                        meta.bg,
                        meta.border,
                      )}
                    >
                      <span>{meta.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-white tracking-tight truncate leading-tight">
                        {agent.name}
                      </h4>
                      <p className="text-3xs text-zinc-300 font-medium truncate mt-0.5">
                        {agent.title || meta.role}
                      </p>
                    </div>
                  </div>

                  {/* Footer Badges inside Card: Skill + Model */}
                  <div className="mt-2 pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-1 text-4xs font-mono">
                    <span className="truncate text-zinc-400 bg-zinc-950/70 px-1.5 py-0.5 rounded border border-zinc-800/80 max-w-[110px]" title={agent.skillName || agent.slug}>
                      {agent.skillName || agent.slug}
                    </span>
                    <span className="truncate text-emerald-400/90 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 max-w-[85px]" title={modelLabel}>
                      {modelLabel}
                    </span>
                  </div>

                  {/* Left Input Port Handle */}
                  <div
                    className="absolute -left-2 top-1/2 -translate-y-1/2 size-4 rounded-full bg-zinc-200 border-2 border-zinc-900 shadow-sm transition-transform hover:scale-125"
                    title={`Input: ${meta.inputContract}`}
                  />

                  {/* Right Output Port Handle */}
                  <div
                    className="absolute -right-2 top-1/2 -translate-y-1/2 size-4 rounded-full bg-zinc-200 border-2 border-zinc-900 shadow-sm transition-transform hover:scale-125"
                    title={`Output: ${meta.outputContract}`}
                  />

                  {/* Output Port Plus (+) Action Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenConfig(agent);
                    }}
                    className="absolute -right-7 top-1/2 -translate-y-1/2 size-4.5 rounded-full bg-zinc-800 hover:bg-primary text-zinc-300 hover:text-white border border-zinc-600 flex items-center justify-center text-3xs transition-colors shadow-xs"
                    title="Add connection or configure"
                  >
                    <Plus className="size-2.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* 3. FINAL SPRINT RELEASE NODE (Unified Stadium Card) */}
          {(() => {
            const pos = getNodePos("release");
            const isSelected = selectedNodeId === "release";

            return (
              <div
                className="canvas-node absolute group cursor-grab active:cursor-grabbing select-none"
                style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
                onMouseDown={(e) => handleNodeMouseDown(e, "release")}
                onClick={() => setSelectedNodeId("release")}
              >
                <div
                  className={cn(
                    "relative flex items-center justify-between w-44 rounded-2xl border-2 bg-zinc-900/95 p-3 shadow-xl transition-all",
                    isSelected ? "border-emerald-400 ring-2 ring-emerald-500/30" : "border-zinc-700 hover:border-zinc-500",
                  )}
                >
                  <div
                    className="absolute -left-2 top-1/2 -translate-y-1/2 size-4 rounded-full bg-zinc-200 border-2 border-zinc-900 shadow-sm"
                    title="Accepts PO Critic verified deliverables"
                  />
                  <div className="flex items-center gap-2.5">
                    <div className="size-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-xl shadow-inner">
                      🚀
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white tracking-tight">Sprint Release</p>
                      <p className="text-3xs text-emerald-400 font-mono">deploy & merge</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Floating Mini Legend on Canvas */}
        <div className="absolute bottom-3 left-3 flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-3xs font-mono text-zinc-400 backdrop-blur-xs">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-zinc-400" />
            <span>Forward Flow</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-cyan-500" />
            <span>QA Feedback Loop</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-rose-500" />
            <span>PO Critic Loop</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* NODE CONFIGURATION MODAL / DRAWER (Opened via Double-Click or Config Button) */}
      {/* ========================================================================= */}
      {configAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div
            className="w-full max-w-2xl max-h-[90vh] rounded-2xl border border-zinc-700 bg-zinc-900 text-zinc-100 shadow-2xl flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-950/60">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-2xl shadow-inner">
                  {getAgentMeta(configAgent).icon}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Configure Node: {configAgent.name}
                    <span className="text-3xs font-mono px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                      {getAgentMeta(configAgent).role}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-300 font-medium">
                    Configure model route, inference gateway, system persona, and attached skills.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfigAgent(null)}
                className="size-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center border-b border-zinc-800 px-6 bg-zinc-950/40">
              <button
                type="button"
                onClick={() => setConfigTab("model")}
                className={cn(
                  "flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors",
                  configTab === "model"
                    ? "border-primary text-primary"
                    : "border-transparent text-zinc-400 hover:text-zinc-200",
                )}
              >
                <Cpu className="size-4" />
                AI Model & Gateway
              </button>
              <button
                type="button"
                onClick={() => setConfigTab("persona")}
                className={cn(
                  "flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors",
                  configTab === "persona"
                    ? "border-primary text-primary"
                    : "border-transparent text-zinc-400 hover:text-zinc-200",
                )}
              >
                <Sliders className="size-4" />
                Persona & Instructions
              </button>
              <button
                type="button"
                onClick={() => setConfigTab("skill")}
                className={cn(
                  "flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors",
                  configTab === "skill"
                    ? "border-primary text-primary"
                    : "border-transparent text-zinc-400 hover:text-zinc-200",
                )}
              >
                <Zap className="size-4" />
                Assigned Skill & Tools
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {saveNotice && (
                <div className={cn(
                  "p-3 rounded-lg border text-xs font-medium flex items-center justify-between",
                  saveNotice.includes("Failed")
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
                )}>
                  <span>{saveNotice}</span>
                  <button onClick={() => setSaveNotice("")}><X className="size-3.5" /></button>
                </div>
              )}

              {/* TAB 1: MODEL & GATEWAY */}
              {configTab === "model" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-2">
                      1-Click Model Presets:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFormRoute("agy");
                          setFormBaseUrl("http://host.docker.internal:3005/v1");
                          setFormModel("gemini-3.8-flash-high");
                        }}
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all text-xs",
                          formRoute === "agy" && formModel === "gemini-3.8-flash-high"
                            ? "bg-primary/20 border-primary ring-2 ring-primary/40 text-white"
                            : "bg-zinc-800/60 border-zinc-700/80 hover:bg-zinc-800 text-zinc-300",
                        )}
                      >
                        <div className="font-semibold flex items-center justify-between">
                          <span className="flex items-center gap-1">⚡ AGY Flash (High)</span>
                          {formRoute === "agy" && formModel === "gemini-3.8-flash-high" && (
                            <Check className="size-3 text-primary" />
                          )}
                        </div>
                        <div className="text-3xs text-zinc-400 font-mono mt-0.5">Logged-in subscription</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFormRoute("agy");
                          setFormBaseUrl("http://host.docker.internal:3005/v1");
                          setFormModel("gemini-3.8-flash-low");
                        }}
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all text-xs",
                          formRoute === "agy" && formModel === "gemini-3.8-flash-low"
                            ? "bg-primary/20 border-primary ring-2 ring-primary/40 text-white"
                            : "bg-zinc-800/60 border-zinc-700/80 hover:bg-zinc-800 text-zinc-300",
                        )}
                      >
                        <div className="font-semibold flex items-center justify-between">
                          <span className="flex items-center gap-1">⚡ AGY Ultra-Fast</span>
                          {formRoute === "agy" && formModel === "gemini-3.8-flash-low" && (
                            <Check className="size-3 text-primary" />
                          )}
                        </div>
                        <div className="text-3xs text-zinc-400 font-mono mt-0.5">gemini-3.8-flash-low</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFormRoute("agy");
                          setFormBaseUrl("http://host.docker.internal:3005/v1");
                          setFormModel("claude-sonnet-4-6");
                        }}
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all text-xs",
                          formRoute === "agy" && formModel === "claude-sonnet-4-6"
                            ? "bg-primary/20 border-primary ring-2 ring-primary/40 text-white"
                            : "bg-zinc-800/60 border-zinc-700/80 hover:bg-zinc-800 text-zinc-300",
                        )}
                      >
                        <div className="font-semibold flex items-center justify-between">
                          <span className="flex items-center gap-1">⚡ Claude Sonnet 4.6</span>
                          {formRoute === "agy" && formModel === "claude-sonnet-4-6" && (
                            <Check className="size-3 text-primary" />
                          )}
                        </div>
                        <div className="text-3xs text-zinc-400 font-mono mt-0.5">via AGY bridge</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFormRoute("ollama");
                          setFormBaseUrl("http://localhost:11434/v1");
                          setFormModel("qwen2.5-coder:latest");
                        }}
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all text-xs",
                          formRoute === "ollama"
                            ? "bg-primary/20 border-primary ring-2 ring-primary/40 text-white"
                            : "bg-zinc-800/60 border-zinc-700/80 hover:bg-zinc-800 text-zinc-300",
                        )}
                      >
                        <div className="font-semibold flex items-center justify-between">
                          <span className="flex items-center gap-1">🦙 Local Ollama</span>
                          {formRoute === "ollama" && (
                            <Check className="size-3 text-primary" />
                          )}
                        </div>
                        <div className="text-3xs text-zinc-400 font-mono mt-0.5">qwen2.5-coder:latest</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFormRoute("lm-studio");
                          setFormBaseUrl("http://localhost:1234/v1");
                          setFormModel("local-model");
                        }}
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all text-xs",
                          formRoute === "lm-studio"
                            ? "bg-primary/20 border-primary ring-2 ring-primary/40 text-white"
                            : "bg-zinc-800/60 border-zinc-700/80 hover:bg-zinc-800 text-zinc-300",
                        )}
                      >
                        <div className="font-semibold flex items-center justify-between">
                          <span className="flex items-center gap-1">💻 LM Studio</span>
                          {formRoute === "lm-studio" && (
                            <Check className="size-3 text-primary" />
                          )}
                        </div>
                        <div className="text-3xs text-zinc-400 font-mono mt-0.5">local-model</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFormRoute("project");
                          setFormBaseUrl("");
                          setFormModel("gemini-3.8-flash-high");
                        }}
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all text-xs",
                          formRoute === "project"
                            ? "bg-primary/20 border-primary ring-2 ring-primary/40 text-white"
                            : "bg-zinc-800/60 border-zinc-700/80 hover:bg-zinc-800 text-zinc-300",
                        )}
                      >
                        <div className="font-semibold flex items-center justify-between">
                          <span className="flex items-center gap-1">⭐ Inherit Default</span>
                          {formRoute === "project" && (
                            <Check className="size-3 text-primary" />
                          )}
                        </div>
                        <div className="text-3xs text-zinc-400 font-mono mt-0.5">System project preset</div>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-zinc-800">
                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1">
                        Inference Provider / Route:
                      </label>
                      <select
                        value={formRoute}
                        onChange={(e) => setFormRoute(e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-white focus:ring-2 focus:ring-primary focus:outline-none"
                      >
                        <option value="project">⭐ Inherit Project Default</option>
                        <option value="agy">⚡ Google Antigravity (AGY)</option>
                        <option value="ollama">🦙 Ollama (Local)</option>
                        <option value="lm-studio">💻 LM Studio (Local)</option>
                        <option value="openrouter">🌐 OpenRouter</option>
                        <option value="openai">🤖 OpenAI / Codex API</option>
                        <option value="gemini">🌟 Google Gemini (Direct API)</option>
                        <option value="custom">⚙️ Custom OpenAI-compatible</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1">
                        Model ID:
                      </label>
                      <Input
                        value={formModel}
                        onChange={(e) => setFormModel(e.target.value)}
                        disabled={formRoute === "project"}
                        placeholder="e.g. gemini-3.8-flash-high"
                        className={cn(
                          "bg-zinc-800 border-zinc-700 text-xs font-mono text-white",
                          formRoute === "project" && "opacity-60 cursor-not-allowed bg-zinc-900 border-zinc-800",
                        )}
                      />
                      {formRoute === "project" && (
                        <p className="text-4xs text-emerald-400 mt-1 font-mono">
                          ✓ Inherited from Project Default (gemini-3.8-flash-high)
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1">
                        Base URL:
                      </label>
                      <Input
                        value={formRoute === "project" ? "http://host.docker.internal:3005/v1 (Inherited)" : formBaseUrl}
                        onChange={(e) => setFormBaseUrl(e.target.value)}
                        disabled={formRoute === "project"}
                        placeholder="http://host.docker.internal:3005/v1"
                        className={cn(
                          "bg-zinc-800 border-zinc-700 text-xs font-mono text-white",
                          formRoute === "project" && "opacity-60 cursor-not-allowed bg-zinc-900 border-zinc-800",
                        )}
                      />
                      {formRoute === "project" && (
                        <p className="text-4xs text-emerald-400 mt-1 font-mono">
                          ✓ Using Project Default AGY Gateway Bridge
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1">
                        API Key (Optional for AGY/Local):
                      </label>
                      <Input
                        type="password"
                        value={formApiKey}
                        onChange={(e) => setFormApiKey(e.target.value)}
                        placeholder={formRoute === "agy" || formRoute === "project" ? "Auto-authenticated via AGY" : "sk-..."}
                        className="bg-zinc-800 border-zinc-700 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PERSONA & INSTRUCTIONS */}
              {configTab === "persona" && (
                <div className="space-y-4">
                  {/* End-User Advocate Critic Callout */}
                  {(configAgent.slug?.includes("critic") ||
                    configAgent.slug?.includes("po") ||
                    configAgent.name?.toLowerCase().includes("nella")) && (
                    <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 text-xs flex items-start gap-2.5">
                      <span className="text-lg">👑</span>
                      <div>
                        <span className="font-bold text-white block">End-User Advocate Critic Perspective:</span>
                        <p className="text-3xs text-rose-200/90 leading-relaxed mt-0.5">
                          Nella puts herself directly into the shoes of an actual end-user. She evaluates workflows, ergonomic friction, feedback clarity, and intuitive product experience before accepting sprint deliverables.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1">
                        Agent Name:
                      </label>
                      <Input
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="bg-zinc-800 border-zinc-700 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1">
                        Agent Title / Role:
                      </label>
                      <Input
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        className="bg-zinc-800 border-zinc-700 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-zinc-300">
                        System Persona & Instructions:
                      </label>
                      <button
                        type="button"
                        onClick={() => setFormPersona(getAgentMeta(configAgent).defaultPersona)}
                        className="text-3xs text-primary hover:underline flex items-center gap-1 font-mono transition-colors"
                        title="Restore original BMad Method persona"
                      >
                        <RotateCcw className="size-3" />
                        Restore BMad Baseline
                      </button>
                    </div>
                    <Textarea
                      value={formPersona}
                      onChange={(e) => setFormPersona(e.target.value)}
                      placeholder="Define the behavior, rules, and methodology for this agent..."
                      rows={7}
                      className="bg-zinc-800 border-zinc-700 text-xs font-mono text-white resize-y leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1">
                      Customization Scope:
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                        <input
                          type="radio"
                          name="scope"
                          checked={formScope === "team"}
                          onChange={() => setFormScope("team")}
                          className="text-primary"
                        />
                        <span>Team Scope (_bmad/custom/config.toml - Committed)</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                        <input
                          type="radio"
                          name="scope"
                          checked={formScope === "personal"}
                          onChange={() => setFormScope("personal")}
                          className="text-primary"
                        />
                        <span>Personal Scope (.user.toml - Gitignored)</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SKILL & TOOLS */}
              {configTab === "skill" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1">
                      Assigned Skill:
                    </label>
                    <select
                      value={formSkill}
                      onChange={(e) => setFormSkill(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-white"
                    >
                      {skills.map((skill) => (
                        <option key={skill.id} value={skill.name}>
                          {skill.name} {skill.isManaged ? "(Custom)" : "(Vendor)"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between text-zinc-400">
                      <span>Input Contract:</span>
                      <span className="text-white font-semibold">{getAgentMeta(configAgent).inputContract}</span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-400 border-t border-zinc-800 pt-2">
                      <span>Output Contract:</span>
                      <span className="text-emerald-400 font-semibold">{getAgentMeta(configAgent).outputContract}</span>
                    </div>
                  </div>
                </div>
              )}

              {testResult && (
                <div className="p-3 rounded-lg border border-zinc-700 bg-zinc-950 text-xs font-mono text-zinc-300 space-y-1">
                  <div className="flex items-center gap-1.5 text-primary font-bold">
                    <CheckCircle2 className="size-3.5" />
                    <span>Live Test Output:</span>
                  </div>
                  <p className="line-clamp-4 text-zinc-400">{testResult}</p>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4 bg-zinc-950/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestNode}
                disabled={isTesting}
                className="gap-1.5 text-xs border-zinc-700 text-zinc-300 hover:text-white"
              >
                {isTesting ? <RefreshCw className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                {isTesting ? "Testing Node..." : "Test Run Node"}
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfigAgent(null)}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveConfig}
                  disabled={isSavingConfig}
                  className="gap-1.5 text-xs font-semibold"
                >
                  {isSavingConfig ? <RefreshCw className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  {isSavingConfig ? "Saving..." : "Save Configuration"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
