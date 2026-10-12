/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import {
  Cpu,
  Zap,
  Sparkles,
  Bot,
  KeyRound,
  CheckCircle2,
  Server,
  Globe,
  Sliders,
  Settings,
  RefreshCw,
  RotateCcw,
  Check,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getBmadControl,
  saveGatewayConfig,
  saveAgentGatewayConfig,
} from "@/actions/bmad-control-actions";

type Props = { owner: string; name: string };

export type ProviderCatalogItem = {
  id: string;
  name: string;
  category: "antigravity" | "local" | "cloud" | "custom";
  icon: string;
  badge: string;
  badgeColor: string;
  description: string;
  defaultBaseUrl: string;
  requiresKey: boolean;
  keyPlaceholder?: string;
  docsUrl?: string;
  models: Array<{
    id: string;
    name: string;
    description: string;
    isDefault?: boolean;
    tag?: string;
  }>;
};

export const PROVIDER_CATALOG: ProviderCatalogItem[] = [
  {
    id: "agy",
    name: "Google Antigravity (AGY)",
    category: "antigravity",
    icon: "⚡",
    badge: "Logged-in Subscription",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    description: "Executes directly through your active Google Antigravity session. Zero separate API key required.",
    defaultBaseUrl: "http://host.docker.internal:3005/v1",
    requiresKey: false,
    models: [
      { id: "gemini-3.8-flash-high", name: "Gemini 3.8 Flash (High Reasoning)", description: "Top recommended default: ultra-responsive with deep reasoning effort.", isDefault: true, tag: "Default" },
      { id: "gemini-3.8-flash-medium", name: "Gemini 3.8 Flash (Medium Reasoning)", description: "Balanced speed and reasoning effort for rapid iterative tasks.", tag: "Balanced" },
      { id: "gemini-3.8-flash-low", name: "Gemini 3.8 Flash (Low / Ultra-Fast)", description: "Highest speed and minimal latency for high-frequency steps.", tag: "Fast" },
      { id: "gemini-3.7-flash-high", name: "Gemini 3.7 Flash", description: "Stable production flash release with high effort reasoning.", tag: "Stable" },
      { id: "gemini-3.1-pro-high", name: "Gemini 3.1 Pro (High Reasoning)", description: "Exceptional depth for complex system architecture and PRD analysis.", tag: "Deep Pro" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6 (Thinking via AGY)", description: "Advanced thinking model provided through your Antigravity subscription.", tag: "Thinking" },
      { id: "claude-opus-4-6-thinking", name: "Claude Opus 4.6 (Thinking via AGY)", description: "Maximum intelligence and reasoning power via AGY subscription.", tag: "Max" },
    ],
  },
  {
    id: "ollama",
    name: "Local Models (Ollama)",
    category: "local",
    icon: "🦙",
    badge: "Local Inference",
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    description: "Completely private, offline local LLM server running on your machine or LAN.",
    defaultBaseUrl: "http://localhost:11434/v1",
    requiresKey: false,
    models: [
      { id: "qwen2.5-coder:latest", name: "Qwen 2.5 Coder", description: "State-of-the-art open coding model for autonomous agents.", isDefault: true, tag: "Code" },
      { id: "llama3.3:latest", name: "Llama 3.3 (70B / 8B)", description: "Meta's flagship open-weights model for reasoning.", tag: "General" },
      { id: "deepseek-r1:latest", name: "DeepSeek R1", description: "Open reasoning model with chain-of-thought distillation.", tag: "Reasoning" },
      { id: "mistral:latest", name: "Mistral", description: "Fast, efficient local model for routine tasks.", tag: "Fast" },
    ],
  },
  {
    id: "lm-studio",
    name: "LM Studio (Local)",
    category: "local",
    icon: "💻",
    badge: "Local GUI Server",
    badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    description: "Local GUI model loader and OpenAI-compatible server.",
    defaultBaseUrl: "http://localhost:1234/v1",
    requiresKey: false,
    models: [
      { id: "local-model", name: "Loaded Model in LM Studio", description: "Routes to whichever model is currently loaded in LM Studio.", isDefault: true, tag: "Loaded" },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    category: "cloud",
    icon: "🌐",
    badge: "Unified Cloud Gateway",
    badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    description: "Access 300+ frontier models through a single API key.",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    requiresKey: true,
    keyPlaceholder: "sk-or-v1-...",
    docsUrl: "https://openrouter.ai/keys",
    models: [
      { id: "anthropic/claude-3.7-sonnet", name: "Claude 3.7 Sonnet", description: "Anthropic's hybrid thinking and high-speed model.", isDefault: true, tag: "Top Tier" },
      { id: "deepseek/deepseek-r1", name: "DeepSeek R1", description: "Frontier reasoning model for complex architectural review.", tag: "Reasoning" },
      { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", description: "Ultra-fast Google model via OpenRouter.", tag: "Fast" },
      { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct", description: "Open frontier model hosted with high throughput.", tag: "Open" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI / Codex API",
    category: "cloud",
    icon: "🤖",
    badge: "Frontier API",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    description: "Official OpenAI cloud inference API for GPT-4o and reasoning models.",
    defaultBaseUrl: "https://api.openai.com/v1",
    requiresKey: true,
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-4o", name: "GPT-4o", description: "Flagship multimodal intelligence model.", isDefault: true, tag: "Flagship" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Lightweight and cost-efficient for quick tasks.", tag: "Fast" },
      { id: "o3-mini", name: "o3-mini", description: "High-intelligence STEM and code reasoning model.", tag: "Reasoning" },
      { id: "o1", name: "o1", description: "Deep thinking frontier model for intricate architecture.", tag: "Deep" },
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini (Direct API)",
    category: "cloud",
    icon: "🌟",
    badge: "Google AI Studio",
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    description: "Direct OpenAI-compatible API from Google AI Studio.",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    requiresKey: true,
    keyPlaceholder: "AIzaSy...",
    docsUrl: "https://aistudio.google.com/app/apikey",
    models: [
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "Next-gen multimodal flash model with real-time speed.", isDefault: true, tag: "Default" },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", description: "Extremely fast with 1M token context window.", tag: "1M Context" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Advanced reasoning for complex coding.", tag: "Pro" },
    ],
  },
  {
    id: "custom",
    name: "Custom OpenAI Endpoint",
    category: "custom",
    icon: "⚙️",
    badge: "Self-Hosted / Proxy",
    badgeColor: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
    description: "Any vLLM, text-generation-webui, or custom proxy exposing /chat/completions.",
    defaultBaseUrl: "https://my-proxy.example.com/v1",
    requiresKey: false,
    keyPlaceholder: "Optional API Key",
    models: [
      { id: "custom-model", name: "Custom Model ID", description: "Provide any model identifier supported by your endpoint.", isDefault: true, tag: "Custom" },
    ],
  },
];

export function ModelsProvidersManager({ owner, name }: Props) {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  // Project Default state
  const [defaultUrl, setDefaultUrl] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [defaultKey, setDefaultKey] = useState("");

  // Agent edits state: map of agentId -> { route, baseUrl, model, key, isEditing }
  const [agentEdits, setAgentEdits] = useState<Record<string, { route: string; baseUrl: string; model: string; key: string; isSaved?: boolean }>>({});

  const loadData = async () => {
    setBusy(true);
    try {
      const res = await getBmadControl({ owner, name });
      if (res.success) {
        const payload: any = res.data;
        setData(payload);
        setDefaultUrl(payload.runtime.gatewayBaseUrl || "http://host.docker.internal:3005/v1");
        setDefaultModel(payload.runtime.gatewayModel || "gemini-3.8-flash-high");

        // Initialize agent edits
        const edits: Record<string, any> = {};
        for (const agent of payload.agents) {
          const isProject = !agent.gatewayConfigured;
          edits[agent.id] = {
            route: isProject ? "project" : agent.providerLabel === "Antigravity (AGY)" ? "agy" : agent.providerLabel === "Google Gemini" ? "gemini" : agent.providerLabel === "OpenAI / Codex API" ? "openai" : agent.providerLabel === "OpenRouter" ? "openrouter" : agent.providerLabel === "Ollama" ? "ollama" : agent.providerLabel === "LM Studio" ? "lm-studio" : "custom",
            baseUrl: agent.gatewayBaseUrl || "",
            model: agent.gatewayModel || payload.runtime.gatewayModel || "gemini-3.8-flash-high",
            key: "",
          };
        }
        setAgentEdits(edits);
      } else {
        setNotice(res.error);
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, name]);

  const handleSaveDefault = async (url: string, model: string, key?: string) => {
    setBusy(true);
    setNotice("");
    try {
      const res = await saveGatewayConfig({
        owner,
        name,
        gatewayBaseUrl: url,
        gatewayModel: model,
        apiKey: key || undefined,
      });
      if (res.success) {
        setNotice(`Project default model updated to ${model}. All new and unassigned agents will use this model.`);
        setDefaultUrl(url);
        setDefaultModel(model);
        await loadData();
      } else {
        setNotice(res.error);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAgentRoute = async (agentId: string) => {
    const edit = agentEdits[agentId];
    if (!edit) return;

    setBusy(true);
    setNotice("");
    try {
      const res = await saveAgentGatewayConfig({
        owner,
        name,
        agentId,
        route: edit.route as any,
        gatewayBaseUrl: edit.route === "project" ? undefined : edit.baseUrl,
        gatewayModel: edit.route === "project" ? undefined : edit.model,
        apiKey: edit.route === "project" || !edit.key ? undefined : edit.key,
      });
      if (res.success) {
        setNotice(`Saved model route for agent.`);
        await loadData();
      } else {
        setNotice(res.error);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResetAllToDefault = async () => {
    if (!data?.agents) return;
    setBusy(true);
    setNotice("");
    try {
      for (const agent of data.agents) {
        await saveAgentGatewayConfig({
          owner,
          name,
          agentId: agent.id,
          route: "project",
        });
      }
      setNotice("All agents have been reset to use the Project Default model.");
      await loadData();
    } finally {
      setBusy(false);
    }
  };

  const activeDefaultModelName = defaultModel || "gemini-3.8-flash-high";
  const activeDefaultProvider = PROVIDER_CATALOG.find((p) =>
    defaultUrl.includes("3005") ? p.id === "agy" :
    defaultUrl.includes("googleapis.com") ? p.id === "gemini" :
    defaultUrl.includes("openai.com") ? p.id === "openai" :
    defaultUrl.includes("openrouter.ai") ? p.id === "openrouter" :
    defaultUrl.includes("11434") ? p.id === "ollama" :
    defaultUrl.includes("1234") ? p.id === "lm-studio" : false
  ) || PROVIDER_CATALOG[0];

  const filteredProviders = PROVIDER_CATALOG.filter(
    (p) => activeCategory === "all" || p.category === activeCategory
  );

  return (
    <div className="space-y-8 px-6 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg border border-primary/20">
              <Cpu className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Models & AI Providers</h1>
              <p className="text-sm text-muted-foreground">
                Configure inference backends (Antigravity subscription, local Ollama, OpenRouter, OpenAI, Gemini), set the system default model, and route agents individually.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={loadData}>
            <RefreshCw className={cn("size-3.5 mr-1.5", busy && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={handleResetAllToDefault} title="Assign all project agents to follow the Project Default model">
            <RotateCcw className="size-3.5 mr-1.5" />
            Reset All Agents to Default
          </Button>
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-sm text-foreground">
          <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* SECTION 1: ACTIVE SYSTEM DEFAULT BANNER */}
      <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-mono tracking-wider px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold">
                Project Default Model
              </span>
              <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                <Check className="size-3" /> Active for All Unassigned & New Agents
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>{activeDefaultProvider.icon}</span>
                <span>{activeDefaultModelName}</span>
              </h2>
              <span className="text-xs text-muted-foreground font-mono">
                via {activeDefaultProvider.name}
              </span>
            </div>

            <p className="text-xs text-muted-foreground max-w-2xl">
              Any agent whose route is set to <strong>Project Default</strong> inherits this configuration. You can change this default below at any time, or assign specific agents to other models in the routing matrix.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-mono text-muted-foreground">
              <div>
                <span className="text-foreground/70 font-semibold">Endpoint: </span>
                <span className="bg-muted px-2 py-0.5 rounded border">{defaultUrl || "http://host.docker.internal:3005/v1"}</span>
              </div>
              <div>
                <span className="text-foreground/70 font-semibold">Auth: </span>
                <span>{defaultUrl.includes("3005") ? "Google Antigravity Session (Auto)" : data?.runtime?.gatewayConfigured ? "Encrypted API Key Configured" : "No Key Required / Local"}</span>
              </div>
            </div>
          </div>

          <div className="shrink-0 bg-muted/40 p-4 rounded-xl border border-border/70 text-xs space-y-2">
            <span className="font-semibold block text-foreground">Quick Switch Project Default:</span>
            <div className="flex flex-col gap-1.5">
              <Button
                size="sm"
                variant={activeDefaultModelName === "gemini-3.8-flash-high" && defaultUrl.includes("3005") ? "default" : "outline"}
                className="justify-start text-xs h-7 font-mono"
                onClick={() => handleSaveDefault("http://host.docker.internal:3005/v1", "gemini-3.8-flash-high")}
              >
                ⚡ Antigravity (Gemini 3.8 Flash High)
              </Button>
              <Button
                size="sm"
                variant={activeDefaultModelName === "gemini-3.8-flash-low" ? "default" : "outline"}
                className="justify-start text-xs h-7 font-mono"
                onClick={() => handleSaveDefault("http://host.docker.internal:3005/v1", "gemini-3.8-flash-low")}
              >
                ⚡ Antigravity (Gemini 3.8 Flash Ultra-Fast)
              </Button>
              <Button
                size="sm"
                variant={activeDefaultModelName === "claude-sonnet-4-6" ? "default" : "outline"}
                className="justify-start text-xs h-7 font-mono"
                onClick={() => handleSaveDefault("http://host.docker.internal:3005/v1", "claude-sonnet-4-6")}
              >
                ⚡ Antigravity (Claude Sonnet 4.6 Thinking)
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: PROVIDERS CATALOG */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Server className="size-4 text-primary" />
              Configured Providers & Model Catalog
            </h2>
            <p className="text-xs text-muted-foreground">
              Select any model below to immediately set it as the Project Default, or view models available for per-agent routing.
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border text-xs">
            {[
              { id: "all", label: "All Providers" },
              { id: "antigravity", label: "⚡ Antigravity" },
              { id: "local", label: "🦙 Local (Ollama/LM Studio)" },
              { id: "cloud", label: "🌐 Cloud (OpenRouter/OpenAI/Gemini)" },
              { id: "custom", label: "⚙️ Custom" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-colors font-medium text-xs",
                  activeCategory === cat.id
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProviders.map((provider) => {
            const isCurrentDefaultProvider =
              (provider.id === "agy" && defaultUrl.includes("3005")) ||
              (provider.id === "ollama" && defaultUrl.includes("11434")) ||
              (provider.id === "lm-studio" && defaultUrl.includes("1234")) ||
              (provider.id === "openrouter" && defaultUrl.includes("openrouter.ai")) ||
              (provider.id === "openai" && defaultUrl.includes("openai.com")) ||
              (provider.id === "gemini" && defaultUrl.includes("googleapis.com"));

            return (
              <div
                key={provider.id}
                className={cn(
                  "flex flex-col justify-between rounded-xl border bg-card p-5 shadow-xs transition-all",
                  isCurrentDefaultProvider
                    ? "border-primary ring-1 ring-primary/40 bg-gradient-to-b from-card to-primary/5"
                    : "border-border/70 hover:border-primary/50"
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{provider.icon}</span>
                      <h3 className="font-bold text-sm text-foreground">{provider.name}</h3>
                    </div>
                    <span className={cn("text-3xs font-mono font-semibold px-2 py-0.5 rounded-full border", provider.badgeColor)}>
                      {provider.badge}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    {provider.description}
                  </p>

                  <div className="mt-3 rounded-lg bg-muted/40 p-2 text-3xs font-mono text-muted-foreground space-y-1">
                    <div className="truncate">
                      <span className="font-bold text-foreground/80">Default Endpoint: </span>
                      <span>{provider.defaultBaseUrl}</span>
                    </div>
                    {provider.requiresKey && (
                      <div className="text-amber-600 dark:text-amber-400">
                        🔑 Requires API key when calling directly
                      </div>
                    )}
                  </div>

                  {/* Models List within Provider */}
                  <div className="mt-4 space-y-2">
                    <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground block">
                      Available Models:
                    </span>
                    <div className="space-y-1.5">
                      {provider.models.map((model) => {
                        const isThisModelDefault =
                          isCurrentDefaultProvider && defaultModel === model.id;

                        return (
                          <div
                            key={model.id}
                            className={cn(
                              "flex items-center justify-between gap-2 rounded-lg border p-2 text-xs transition-colors",
                              isThisModelDefault
                                ? "border-primary bg-primary/10 font-medium"
                                : "border-border/60 bg-background hover:border-border"
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-semibold text-xs text-foreground truncate">
                                  {model.id}
                                </span>
                                {model.tag && (
                                  <span className="text-3xs font-mono px-1.5 py-0.25 rounded bg-muted text-muted-foreground border">
                                    {model.tag}
                                  </span>
                                )}
                              </div>
                              <p className="text-3xs text-muted-foreground truncate">{model.description}</p>
                            </div>

                            <Button
                              size="sm"
                              variant={isThisModelDefault ? "default" : "outline"}
                              className="h-6 text-3xs px-2 shrink-0 font-mono"
                              disabled={isThisModelDefault || busy}
                              onClick={() => handleSaveDefault(provider.defaultBaseUrl, model.id)}
                            >
                              {isThisModelDefault ? "Active Default" : "Set Default"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {provider.docsUrl && (
                  <div className="mt-4 pt-3 border-t border-border/50 flex justify-end">
                    <a
                      href={provider.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-3xs text-muted-foreground hover:text-primary flex items-center gap-1"
                    >
                      Get API Key <ExternalLink className="size-2.5" />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 3: AGENT ROUTING MATRIX */}
      <section className="space-y-4 pt-4 border-t">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Bot className="size-4 text-primary" />
              Agent Model Routing Matrix
            </h2>
            <p className="text-xs text-muted-foreground">
              Configure each agent individually. By default, every agent inherits the <strong>Project Default Model ({activeDefaultModelName})</strong>. Override any agent with a specialized model below.
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b text-3xs uppercase font-mono tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-3 px-4">Agent Identity</th>
                  <th className="py-3 px-4">Current Assigned Route & Model</th>
                  <th className="py-3 px-4">Change Model Route</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data?.agents?.map((agent: any) => {
                  const edit = agentEdits[agent.id] || { route: "project", baseUrl: "", model: activeDefaultModelName, key: "" };
                  const isProjectDefault = edit.route === "project";

                  return (
                    <tr key={agent.id} className="hover:bg-muted/20 transition-colors">
                      {/* Agent Identity */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className="size-8 rounded-lg bg-muted flex items-center justify-center text-lg border shrink-0">
                            {agent.icon || "🤖"}
                          </span>
                          <div>
                            <span className="font-semibold text-sm text-foreground block">{agent.name}</span>
                            <span className="text-3xs text-muted-foreground">{agent.title} · Skill: {agent.skillName || agent.slug}</span>
                          </div>
                        </div>
                      </td>

                      {/* Current Assigned Route */}
                      <td className="py-3 px-4">
                        {agent.gatewayConfigured ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 font-mono text-3xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                              <Cpu className="size-2.5" /> {agent.gatewayModel}
                            </span>
                            <span className="block text-3xs text-muted-foreground font-mono">
                              via {agent.providerLabel || "Custom"}
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 font-mono text-3xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <Check className="size-2.5" /> Project Default
                            </span>
                            <span className="block text-3xs text-muted-foreground font-mono">
                              ({activeDefaultModelName})
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Change Model Route Dropdown */}
                      <td className="py-3 px-4">
                        <div className="space-y-2 max-w-sm">
                          <select
                            className="h-8 w-full rounded-md border bg-background px-2.5 text-xs font-medium"
                            value={
                              isProjectDefault
                                ? "project"
                                : `${edit.route}:${edit.model}`
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "project") {
                                setAgentEdits({
                                  ...agentEdits,
                                  [agent.id]: {
                                    route: "project",
                                    baseUrl: "",
                                    model: activeDefaultModelName,
                                    key: "",
                                  },
                                });
                                return;
                              }

                              const [route, modelId] = val.split(":");
                              const provider = PROVIDER_CATALOG.find((p) => p.id === route);
                              setAgentEdits({
                                ...agentEdits,
                                [agent.id]: {
                                  route,
                                  baseUrl: provider?.defaultBaseUrl || "",
                                  model: modelId,
                                  key: edit.key || "",
                                },
                              });
                            }}
                          >
                            <option value="project">
                              ⭐️ Use Project Default ({activeDefaultModelName})
                            </option>

                            <optgroup label="⚡ Google Antigravity (AGY Subscription)">
                              <option value="agy:gemini-3.8-flash-high">⚡ AGY: Gemini 3.8 Flash (High Reasoning - Recommended)</option>
                              <option value="agy:gemini-3.8-flash-medium">⚡ AGY: Gemini 3.8 Flash (Medium Reasoning)</option>
                              <option value="agy:gemini-3.8-flash-low">⚡ AGY: Gemini 3.8 Flash (Ultra-Fast)</option>
                              <option value="agy:gemini-3.7-flash-high">⚡ AGY: Gemini 3.7 Flash</option>
                              <option value="agy:gemini-3.1-pro-high">⚡ AGY: Gemini 3.1 Pro (Deep Architecture)</option>
                              <option value="agy:claude-sonnet-4-6">⚡ AGY: Claude Sonnet 4.6 (Thinking)</option>
                              <option value="agy:claude-opus-4-6-thinking">⚡ AGY: Claude Opus 4.6 (Thinking)</option>
                            </optgroup>

                            <optgroup label="🦙 Local Models (Ollama)">
                              <option value="ollama:qwen2.5-coder:latest">🦙 Ollama: Qwen 2.5 Coder</option>
                              <option value="ollama:llama3.3:latest">🦙 Ollama: Llama 3.3</option>
                              <option value="ollama:deepseek-r1:latest">🦙 Ollama: DeepSeek R1</option>
                            </optgroup>

                            <optgroup label="🌐 OpenRouter">
                              <option value="openrouter:anthropic/claude-3.7-sonnet">🌐 OpenRouter: Claude 3.7 Sonnet</option>
                              <option value="openrouter:deepseek/deepseek-r1">🌐 OpenRouter: DeepSeek R1</option>
                              <option value="openrouter:google/gemini-2.0-flash-001">🌐 OpenRouter: Gemini 2.0 Flash</option>
                            </optgroup>

                            <optgroup label="🤖 OpenAI / Codex API">
                              <option value="openai:gpt-4o">🤖 OpenAI: GPT-4o</option>
                              <option value="openai:gpt-4o-mini">🤖 OpenAI: GPT-4o Mini</option>
                              <option value="openai:o3-mini">🤖 OpenAI: o3-mini (Reasoning)</option>
                              <option value="openai:o1">🤖 OpenAI: o1</option>
                            </optgroup>

                            <optgroup label="🌟 Google Gemini Direct API">
                              <option value="gemini:gemini-2.0-flash">🌟 Gemini Direct: Gemini 2.0 Flash</option>
                              <option value="gemini:gemini-1.5-flash">🌟 Gemini Direct: Gemini 1.5 Flash</option>
                              <option value="gemini:gemini-2.5-pro">🌟 Gemini Direct: Gemini 2.5 Pro</option>
                            </optgroup>
                          </select>

                          {/* Extra Inputs for Cloud API keys if not using AGY or Project */}
                          {!isProjectDefault && edit.route !== "agy" && edit.route !== "ollama" && edit.route !== "lm-studio" && (
                            <Input
                              type="password"
                              className="h-7 text-3xs font-mono"
                              placeholder={agent.gatewayKeyConfigured ? "Saved — enter only to replace" : "API key required"}
                              value={edit.key}
                              onChange={(e) =>
                                setAgentEdits({
                                  ...agentEdits,
                                  [agent.id]: { ...edit, key: e.target.value },
                                })
                              }
                            />
                          )}
                        </div>
                      </td>

                      {/* Save Action */}
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          className="h-8 text-xs font-semibold gap-1"
                          disabled={busy}
                          onClick={() => handleSaveAgentRoute(agent.id)}
                        >
                          <Check className="size-3" /> Save Route
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
