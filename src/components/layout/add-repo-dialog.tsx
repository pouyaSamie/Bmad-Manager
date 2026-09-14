"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  Lock,
  Globe,
  FolderGit2,
  FolderOpen,
  Loader2,
  Github,
  ChevronDown,
  ChevronRight,
  Sliders,
  Sparkles,
  TerminalSquare,
  Bot,
} from "lucide-react";
import {
  listUserRepos,
  detectBmadRepos,
  importRepo,
  importLocalFolder,
  getAvailableLocalProjects,
} from "@/actions/repo-actions";
import type { GitHubRepo } from "@/lib/github/types";
import type { AvailableLocalProject } from "@/lib/path-utils";
import type { BmadInstallOptions } from "@/lib/bmad-control";

interface AddRepoDialogProps {
  trigger?: React.ReactNode;
  importedRepos?: { owner: string; name: string }[];
  localFsEnabled?: boolean;
  githubEnabled?: boolean;
}

export function AddRepoDialog({
  trigger,
  importedRepos = [],
  localFsEnabled = false,
  githubEnabled = true,
}: AddRepoDialogProps) {
  const importedSet = useMemo(
    () => new Set(importedRepos.map((r) => `${r.owner}/${r.name}`)),
    [importedRepos]
  );
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState("");
  const [detectWarning, setDetectWarning] = useState("");
  const [unknownDetectCount, setUnknownDetectCount] = useState(0);
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState<string | null>(null);
  const [importError, setImportError] = useState("");

  // Local folder state
  const [localPath, setLocalPath] = useState("");
  const [localImporting, setLocalImporting] = useState(false);
  const [localError, setLocalError] = useState("");
  const [detectedProjects, setDetectedProjects] = useState<AvailableLocalProject[]>([]);
  const [scanningProjects, setScanningProjects] = useState(false);

  const defaultTab = githubEnabled ? "github" : "local";

  const fetchRepos = useCallback(async () => {
    if (!githubEnabled) return;
    setLoading(true);
    setError("");
    setDetectWarning("");
    setUnknownDetectCount(0);
    setRepos([]);
    setSearch("");
    setDetecting(false);

    const result = await listUserRepos();
    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setRepos(result.data);
    setLoading(false);

    if (result.data.length > 0) {
      setDetecting(true);
      const ids = result.data.map((r) => ({
        fullName: r.fullName,
        owner: r.owner,
        name: r.name,
      }));

      const bmadResult = await detectBmadRepos(ids);
      if (bmadResult.success) {
        // Per-repo null = detection failed for that batch. Surface the
        // count so users see "X repos couldn't be scanned" rather than
        // silently being told "no BMAD" for repos we never confirmed.
        const unknownCount = Object.values(bmadResult.data).filter(
          (v) => v === null,
        ).length;
        setUnknownDetectCount(unknownCount);

        setRepos((prev) => {
          const updated = prev.map((r) => ({
            ...r,
            hasBmad: bmadResult.data[r.fullName] ?? false,
          }));
          updated.sort((a, b) => {
            if (a.hasBmad !== b.hasBmad) return a.hasBmad ? -1 : 1;
            return (
              new Date(b.updatedAt).getTime() -
              new Date(a.updatedAt).getTime()
            );
          });
          return updated;
        });
      } else {
        // Detection failed (rate limit, too many repos, transient GraphQL
        // error). The list is still usable — show a non-blocking warning
        // so the user understands BMAD badges may be missing.
        setDetectWarning(
          bmadResult.code === "LIMIT_EXCEEDED"
            ? "Too many repositories to scan for BMAD — badges may be missing."
            : "Could not detect BMAD repositories — badges may be missing."
        );
      }
      setDetecting(false);
    }
  }, [githubEnabled]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen && githubEnabled) {
      fetchRepos();
    }
    if (nextOpen && localFsEnabled) {
      setScanningProjects(true);
      getAvailableLocalProjects()
        .then((res) => {
          if (res.success) setDetectedProjects(res.data);
        })
        .finally(() => setScanningProjects(false));
    }
    if (!nextOpen) {
      setLocalPath("");
      setLocalError("");
      setLocalImporting(false);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return repos;
    const q = search.toLowerCase();
    return repos.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
    );
  }, [repos, search]);

  async function handleSelectRepo(repo: GitHubRepo) {
    setImporting(repo.fullName);
    setImportError("");

    const result = await importRepo({
      owner: repo.owner,
      name: repo.name,
      description: repo.description,
      defaultBranch: repo.defaultBranch,
      fullName: repo.fullName,
    });

    if (result.success) {
      setOpen(false);
      router.refresh();
    } else {
      setImportError(result.error);
    }
    setImporting(null);
  }

  async function handleImportLocal(path: string, options?: BmadInstallOptions) {
    if (!path.trim()) return;

    setLocalImporting(true);
    setLocalError("");

    const result = await importLocalFolder({
      localPath: path.trim(),
      installOptions: options,
    });

    if (result.success) {
      setOpen(false);
      router.refresh();
    } else {
      setLocalError(result.error);
    }
    setLocalImporting(false);
  }

  const showTabs = githubEnabled && localFsEnabled;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="h-5 w-5">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 pb-2 border-b border-border/40">
          <DialogTitle>Add a project</DialogTitle>
        </DialogHeader>

        {showTabs ? (
          <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full shrink-0">
              <TabsTrigger value="github" className="flex-1">
                <Github className="mr-1.5 h-4 w-4" />
                GitHub
              </TabsTrigger>
              <TabsTrigger value="local" className="flex-1">
                <FolderOpen className="mr-1.5 h-4 w-4" />
                Local Folder
              </TabsTrigger>
            </TabsList>
            <TabsContent value="github" className="flex-1 min-h-0 mt-3">
              <GitHubRepoList
                search={search}
                setSearch={setSearch}
                loading={loading}
                detecting={detecting}
                error={error}
                detectWarning={detectWarning}
                unknownDetectCount={unknownDetectCount}
                importError={importError}
                filtered={filtered}
                importing={importing}
                importedSet={importedSet}
                onSelect={handleSelectRepo}
              />
            </TabsContent>
            <TabsContent value="local" className="flex-1 min-h-0 mt-3 overflow-y-auto">
              <LocalFolderForm
                localPath={localPath}
                setLocalPath={setLocalPath}
                localImporting={localImporting}
                localError={localError}
                detectedProjects={detectedProjects}
                scanningProjects={scanningProjects}
                onImport={handleImportLocal}
              />
            </TabsContent>
          </Tabs>
        ) : localFsEnabled ? (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <LocalFolderForm
              localPath={localPath}
              setLocalPath={setLocalPath}
              localImporting={localImporting}
              localError={localError}
              detectedProjects={detectedProjects}
              scanningProjects={scanningProjects}
              onImport={handleImportLocal}
            />
          </div>
        ) : (
          <GitHubRepoList
            search={search}
            setSearch={setSearch}
            loading={loading}
            detecting={detecting}
            error={error}
            detectWarning={detectWarning}
            unknownDetectCount={unknownDetectCount}
            importError={importError}
            filtered={filtered}
            importing={importing}
            importedSet={importedSet}
            onSelect={handleSelectRepo}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function GitHubRepoList({
  search,
  setSearch,
  loading,
  detecting,
  error,
  detectWarning,
  unknownDetectCount,
  importError,
  filtered,
  importing,
  importedSet,
  onSelect,
}: {
  search: string;
  setSearch: (v: string) => void;
  loading: boolean;
  detecting: boolean;
  error: string;
  detectWarning: string;
  unknownDetectCount: number;
  importError: string;
  filtered: GitHubRepo[];
  importing: string | null;
  importedSet: Set<string>;
  onSelect: (repo: GitHubRepo) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search for a repository..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          disabled={loading}
        />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {importError && <p className="text-destructive text-sm">{importError}</p>}
      {detectWarning && (
        <p className="text-amber-600 dark:text-amber-400 text-xs">
          {detectWarning}
        </p>
      )}
      {unknownDetectCount > 0 && (
        <p className="text-amber-600 dark:text-amber-400 text-xs">
          BMAD detection failed for {unknownDetectCount}{" "}
          {unknownDetectCount === 1 ? "repository" : "repositories"} —
          these may be mis-labelled as &ldquo;no BMAD&rdquo;.
        </p>
      )}
      {detecting && (
        <p className="text-muted-foreground text-xs animate-pulse">
          Detecting BMAD files...
        </p>
      )}

      <ScrollArea className="h-80">
        {loading ? (
          <div className="space-y-3 p-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <Skeleton className="h-8 w-8 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1 p-1">
            {filtered.length === 0 && !error && (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {search ? "No repository found" : "No repository available"}
              </p>
            )}
            {filtered.map((repo) => {
              const isImporting = importing === repo.fullName;
              const isAlreadyImported = importedSet.has(
                `${repo.owner}/${repo.name}`
              );
              const isDisabled = importing !== null || isAlreadyImported;

              return (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => onSelect(repo)}
                  disabled={isDisabled}
                  className="hover:bg-accent flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:pointer-events-none disabled:opacity-50"
                >
                  {isImporting ? (
                    <Loader2 className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0 animate-spin" />
                  ) : (
                    <FolderGit2 className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {repo.fullName}
                      </span>
                      {isAlreadyImported && (
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          Imported
                        </Badge>
                      )}
                      {repo.hasBmad && !isAlreadyImported && (
                        <Badge variant="default" className="shrink-0 text-xs">
                          BMAD
                        </Badge>
                      )}
                      {repo.isPrivate ? (
                        <Lock className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <Globe className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-muted-foreground mt-0.5 truncate text-xs [text-wrap:auto]">
                        {repo.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

const RECOMMENDED_TOOLS = [
  { id: "codex", name: "Codex", target: ".agents/skills", desc: "Standard for BMad & OpenAI Codex" },
  { id: "claude-code", name: "Claude Code", target: ".claude/skills", desc: "Anthropic Claude Code CLI" },
  { id: "cursor", name: "Cursor", target: ".agents/skills", desc: "Cursor AI editor" },
  { id: "github-copilot", name: "GitHub Copilot", target: ".agents/skills", desc: "VS Code Copilot extension" },
  { id: "antigravity", name: "Google Antigravity", target: ".agent/skills", desc: "Antigravity IDE workspace" },
  { id: "antigravity-cli", name: "Antigravity CLI (AGY)", target: ".agents/skills", desc: "Antigravity CLI runner" },
];

const ADDITIONAL_TOOLS = [
  { id: "windsurf", name: "Windsurf", target: ".agents/skills", desc: "Codeium Windsurf IDE" },
  { id: "cline", name: "Cline", target: ".cline/skills", desc: "Autonomous coding agent" },
  { id: "gemini", name: "Gemini CLI", target: ".agents/skills", desc: "Google Gemini CLI" },
  { id: "roo", name: "Roo Code", target: ".agents/skills", desc: "Roo Cline fork" },
  { id: "openhands", name: "OpenHands", target: ".agents/skills", desc: "OpenHands software agent" },
  { id: "trae", name: "Trae", target: ".trae/skills", desc: "ByteDance Trae IDE" },
  { id: "qwen", name: "QwenCoder", target: ".qwen/skills", desc: "Alibaba Qwen Coder" },
  { id: "kimi-code", name: "Kimi Code", target: ".agents/skills", desc: "Moonshot Kimi Code" },
];

const AVAILABLE_MODULES = [
  {
    id: "bmm",
    name: "BMad Method (BMM)",
    desc: "Agile AiDD module with standard roles (Mary, John, Sally, Winston, Amelia, Murat, Nella)",
    recommended: true,
  },
  {
    id: "bmb",
    name: "BMad Builder (BMB)",
    desc: "Module development toolkit for authoring custom BMAD modules and agent skills",
    recommended: false,
  },
];

const AVAILABLE_LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Japanese",
  "Chinese",
  "Portuguese",
  "Italian",
  "Korean",
  "Russian",
  "Arabic",
];

function LocalFolderForm({
  localPath,
  setLocalPath,
  localImporting,
  localError,
  detectedProjects = [],
  scanningProjects = false,
  onImport,
}: {
  localPath: string;
  setLocalPath: (v: string) => void;
  localImporting: boolean;
  localError: string;
  detectedProjects?: AvailableLocalProject[];
  scanningProjects?: boolean;
  onImport: (path: string, options: BmadInstallOptions) => void;
}) {
  const [selectedTools, setSelectedTools] = useState<string[]>(["codex"]);
  const [selectedModules, setSelectedModules] = useState<string[]>(["bmm"]);
  const [userName, setUserName] = useState("Developer");
  const [communicationLanguage, setCommunicationLanguage] = useState("English");
  const [documentOutputLanguage, setDocumentOutputLanguage] = useState("English");
  const [outputFolder, setOutputFolder] = useState("_bmad-output");
  const [channel, setChannel] = useState<"stable" | "next">("stable");
  const [shims, setShims] = useState(false);
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [showWizard, setShowWizard] = useState(true);

  const selectedDetected = detectedProjects.find((p) => p.path === localPath);
  const isExistingBmad = selectedDetected ? selectedDetected.hasBmad : false;

  function toggleTool(id: string) {
    setSelectedTools((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((t) => t !== id);
        return next.length > 0 ? next : ["codex"];
      }
      return [...prev, id];
    });
  }

  function toggleModule(id: string) {
    setSelectedModules((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((m) => m !== id);
        return next.length > 0 ? next : ["bmm"];
      }
      return [...prev, id];
    });
  }

  function getInstallOptions(): BmadInstallOptions {
    return {
      tools: selectedTools.length ? selectedTools : ["codex"],
      modules: selectedModules.length ? selectedModules : ["bmm"],
      userName: userName.trim() || "Developer",
      communicationLanguage: communicationLanguage.trim() || "English",
      documentOutputLanguage: documentOutputLanguage.trim() || "English",
      outputFolder: outputFolder.trim() || "_bmad-output",
      channel,
      shims,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!localPath.trim()) return;
    onImport(localPath.trim(), getInstallOptions());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-1">
      {/* Workspace Scan */}
      {scanningProjects ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Scanning workspace for BMAD projects...</span>
        </div>
      ) : detectedProjects.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Detected in Workspace
          </p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-lg border p-1.5">
            {detectedProjects.map((proj) => {
              const isSelected = localPath === proj.path;
              return (
                <div
                  key={proj.path}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md p-2 transition-colors",
                    isSelected ? "bg-primary/10 border border-primary/40" : "hover:bg-muted/60"
                  )}
                >
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => setLocalPath(proj.path)}
                  >
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-medium truncate">{proj.name}</span>
                      {proj.hasBmad ? (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">
                          BMAD
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/40 text-primary flex items-center gap-1">
                          <Sparkles className="size-2.5" />
                          Auto-installs BMAD
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5 font-mono">
                      {proj.displayPath}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={proj.hasBmad ? "secondary" : "default"}
                    className="h-7 px-3 text-xs shrink-0"
                    disabled={localImporting}
                    onClick={() => {
                      setLocalPath(proj.path);
                      onImport(proj.path, getInstallOptions());
                    }}
                  >
                    {localImporting && localPath === proj.path ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : proj.hasBmad ? (
                      "Import"
                    ) : (
                      "Install & Add"
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Folder Path Input */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {detectedProjects.length > 0 ? "Or Enter Path Manually" : "Folder Path"}
        </label>
        <Input
          placeholder="C:\workspace\your-project or /workspace/your-project"
          value={localPath}
          onChange={(e) => setLocalPath(e.target.value)}
          disabled={localImporting}
          autoComplete="off"
          className="h-9 text-xs"
        />
        <p className="text-xs text-muted-foreground">
          {isExistingBmad
            ? "BMAD is detected in this folder. It will be imported immediately."
            : "If BMAD is not present in this folder, it will be automatically installed according to the wizard options below."}
        </p>
      </div>

      {/* BMAD Installation Wizard Options */}
      <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-3.5 shadow-2xs">
        <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
          <div className="flex items-center gap-2">
            <Sliders className="size-4 text-primary" />
            <div>
              <h4 className="text-xs font-semibold text-foreground">BMAD Installation Wizard</h4>
              <p className="text-[11px] text-muted-foreground">
                {selectedModules.length} module(s) · {selectedTools.length} tool(s) · {communicationLanguage} · {channel}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => setShowWizard(!showWizard)}
          >
            {showWizard ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            <span>{showWizard ? "Collapse" : "Configure"}</span>
          </Button>
        </div>

        {showWizard && (
          <div className="space-y-4 text-xs">
            {/* 1. Tools Selection (Checkboxes) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <TerminalSquare className="size-3.5 text-primary" />
                  Target Tools / IDEs (Checkboxes)
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedTools(RECOMMENDED_TOOLS.map((t) => t.id))}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Select All Recommended
                  </button>
                  <span className="text-muted-foreground/40">·</span>
                  <button
                    type="button"
                    onClick={() => setSelectedTools(["codex"])}
                    className="text-[11px] text-muted-foreground hover:underline"
                  >
                    Codex Only
                  </button>
                </div>
              </div>

              {/* Recommended tools grid */}
              <div className="grid gap-2 sm:grid-cols-2">
                {RECOMMENDED_TOOLS.map((tool) => {
                  const isChecked = selectedTools.includes(tool.id);
                  return (
                    <label
                      key={tool.id}
                      className={cn(
                        "flex items-start gap-2.5 rounded-lg border p-2 text-xs cursor-pointer transition-colors select-none",
                        isChecked
                          ? "border-primary/60 bg-primary/5 text-foreground"
                          : "border-border/60 hover:bg-muted/40 text-muted-foreground"
                      )}
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={isChecked}
                        onCheckedChange={() => toggleTool(tool.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium truncate">{tool.name}</span>
                          <span className="text-[9px] uppercase tracking-wider text-primary font-bold">
                            Rec
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">
                          {tool.target}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Additional tools toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowMoreTools(!showMoreTools)}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 mt-1"
                >
                  {showMoreTools ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                  <span>{showMoreTools ? "Hide additional tools" : `Show ${ADDITIONAL_TOOLS.length} more IDEs/tools...`}</span>
                </button>

                {showMoreTools && (
                  <div className="grid gap-2 sm:grid-cols-2 mt-2 pt-2 border-t border-border/40">
                    {ADDITIONAL_TOOLS.map((tool) => {
                      const isChecked = selectedTools.includes(tool.id);
                      return (
                        <label
                          key={tool.id}
                          className={cn(
                            "flex items-start gap-2.5 rounded-lg border p-2 text-xs cursor-pointer transition-colors select-none",
                            isChecked
                              ? "border-primary/60 bg-primary/5 text-foreground"
                              : "border-border/60 hover:bg-muted/40 text-muted-foreground"
                          )}
                        >
                          <Checkbox
                            className="mt-0.5"
                            checked={isChecked}
                            onCheckedChange={() => toggleTool(tool.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <span className="font-medium truncate">{tool.name}</span>
                            <p className="text-[10px] text-muted-foreground font-mono truncate">
                              {tool.target}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Modules Selection (Checkboxes) */}
            <div className="space-y-2">
              <label className="font-semibold text-foreground flex items-center gap-1.5">
                <Bot className="size-3.5 text-primary" />
                Modules (Checkboxes)
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {AVAILABLE_MODULES.map((mod) => {
                  const isChecked = selectedModules.includes(mod.id);
                  return (
                    <label
                      key={mod.id}
                      className={cn(
                        "flex items-start gap-2.5 rounded-lg border p-2.5 text-xs cursor-pointer transition-colors select-none",
                        isChecked
                          ? "border-primary/60 bg-primary/5 text-foreground"
                          : "border-border/60 hover:bg-muted/40 text-muted-foreground"
                      )}
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={isChecked}
                        onCheckedChange={() => toggleModule(mod.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">{mod.name}</span>
                          {mod.recommended && (
                            <span className="text-[9px] uppercase tracking-wider text-primary font-bold">
                              Core
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">
                          {mod.desc}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 3. Personalization & Output (Pre-filled Defaults & Selectors) */}
            <div className="grid gap-3 sm:grid-cols-2 pt-1 border-t border-border/40">
              <div>
                <label className="font-medium text-foreground block mb-1">
                  User Name (for agents)
                </label>
                <Input
                  className="h-8 text-xs"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Developer"
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">
                  Output Folder
                </label>
                <Input
                  className="h-8 text-xs font-mono"
                  value={outputFolder}
                  onChange={(e) => setOutputFolder(e.target.value)}
                  placeholder="_bmad-output"
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">
                  Communication Language
                </label>
                <select
                  className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                  value={communicationLanguage}
                  onChange={(e) => setCommunicationLanguage(e.target.value)}
                >
                  {AVAILABLE_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">
                  Document Output Language
                </label>
                <select
                  className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                  value={documentOutputLanguage}
                  onChange={(e) => setDocumentOutputLanguage(e.target.value)}
                >
                  {AVAILABLE_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4. Release Channel & Shims (Segmented Selectors) */}
            <div className="grid gap-3 sm:grid-cols-2 pt-1 border-t border-border/40">
              <div>
                <label className="font-medium text-foreground block mb-1">
                  Release Channel
                </label>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-input p-0.5 bg-muted/20">
                  <button
                    type="button"
                    onClick={() => setChannel("stable")}
                    className={cn(
                      "rounded-md py-1 px-2 text-center text-[11px] transition-all",
                      channel === "stable"
                        ? "bg-background font-semibold text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Stable (Official)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel("next")}
                    className={cn(
                      "rounded-md py-1 px-2 text-center text-[11px] transition-all",
                      channel === "next"
                        ? "bg-background font-semibold text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Next (HEAD)
                  </button>
                </div>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">
                  Install Deprecated Shims
                </label>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-input p-0.5 bg-muted/20">
                  <button
                    type="button"
                    onClick={() => setShims(false)}
                    className={cn(
                      "rounded-md py-1 px-2 text-center text-[11px] transition-all",
                      !shims
                        ? "bg-background font-semibold text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    No (Recommended)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShims(true)}
                    className={cn(
                      "rounded-md py-1 px-2 text-center text-[11px] transition-all",
                      shims
                        ? "bg-background font-semibold text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Yes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {localError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
          {localError}
        </div>
      )}

      {/* Action Button */}
      <Button
        type="submit"
        className="w-full h-9"
        disabled={localImporting || !localPath.trim()}
      >
        {localImporting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Installing BMAD & configuring project...
          </>
        ) : isExistingBmad ? (
          <>
            <FolderOpen className="mr-2 h-4 w-4" />
            Import local BMAD folder
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Install BMAD & Add Project
          </>
        )}
      </Button>
    </form>
  );
}
