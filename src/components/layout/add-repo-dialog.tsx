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
import {
  Plus,
  Search,
  Lock,
  Globe,
  FolderGit2,
  FolderOpen,
  Loader2,
  Github,
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

  async function handleImportLocal(e: React.FormEvent) {
    e.preventDefault();
    if (!localPath.trim()) return;

    setLocalImporting(true);
    setLocalError("");

    const result = await importLocalFolder({ localPath: localPath.trim() });

    if (result.success) {
      setOpen(false);
      router.refresh();
    } else {
      setLocalError(result.error);
    }
    setLocalImporting(false);
  }

  async function handleQuickImport(projectPath: string) {
    setLocalImporting(true);
    setLocalError("");

    const result = await importLocalFolder({ localPath: projectPath });

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a project</DialogTitle>
        </DialogHeader>

        {showTabs ? (
          <Tabs defaultValue={defaultTab}>
            <TabsList className="w-full">
              <TabsTrigger value="github" className="flex-1">
                <Github className="mr-1.5 h-4 w-4" />
                GitHub
              </TabsTrigger>
              <TabsTrigger value="local" className="flex-1">
                <FolderOpen className="mr-1.5 h-4 w-4" />
                Local Folder
              </TabsTrigger>
            </TabsList>
            <TabsContent value="github">
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
            <TabsContent value="local">
              <LocalFolderForm
                localPath={localPath}
                setLocalPath={setLocalPath}
                localImporting={localImporting}
                localError={localError}
                detectedProjects={detectedProjects}
                scanningProjects={scanningProjects}
                onQuickImport={handleQuickImport}
                onSubmit={handleImportLocal}
              />
            </TabsContent>
          </Tabs>
        ) : localFsEnabled ? (
          <LocalFolderForm
            localPath={localPath}
            setLocalPath={setLocalPath}
            localImporting={localImporting}
            localError={localError}
            detectedProjects={detectedProjects}
            scanningProjects={scanningProjects}
            onQuickImport={handleQuickImport}
            onSubmit={handleImportLocal}
          />
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

function LocalFolderForm({
  localPath,
  setLocalPath,
  localImporting,
  localError,
  detectedProjects = [],
  scanningProjects = false,
  onQuickImport,
  onSubmit,
}: {
  localPath: string;
  setLocalPath: (v: string) => void;
  localImporting: boolean;
  localError: string;
  detectedProjects?: AvailableLocalProject[];
  scanningProjects?: boolean;
  onQuickImport: (path: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 pt-2">
      {scanningProjects ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Scanning workspace for BMAD projects...</span>
        </div>
      ) : detectedProjects.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Detected in Workspace
          </p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-lg border p-2">
            {detectedProjects.map((proj) => (
              <div
                key={proj.path}
                className="flex items-center justify-between gap-3 rounded-md p-2 hover:bg-muted/60 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-medium truncate">{proj.name}</span>
                    {proj.hasBmad && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">
                        BMAD
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
                  variant="secondary"
                  className="h-7 px-3 text-xs shrink-0"
                  disabled={localImporting}
                  onClick={() => onQuickImport(proj.path)}
                >
                  {localImporting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Import"
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {detectedProjects.length > 0 ? "Or Enter Path Manually" : "Folder Path"}
        </label>
        <Input
          placeholder="C:\workspace\your-project or /workspace/your-project"
          value={localPath}
          onChange={(e) => setLocalPath(e.target.value)}
          disabled={localImporting}
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Supports Windows paths (e.g. <code>C:\workspace\project</code>) or Linux/Docker paths. The folder must contain a <code>_bmad/</code> or <code>_bmad-output/</code> directory.
        </p>
      </div>

      {localError && (
        <p className="text-destructive text-sm">{localError}</p>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={localImporting || !localPath.trim()}
      >
        {localImporting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FolderOpen className="mr-2 h-4 w-4" />
        )}
        Import local folder
      </Button>
    </form>
  );
}
