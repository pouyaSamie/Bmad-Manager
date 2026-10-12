"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Cpu,
  Eye,
  FileText,
  FolderGit2,
  FolderOpen,
  LayoutDashboard,
  Map,
  Plus,
  Search,
  Shield,
  Sparkles,
  Trash2,
  Workflow,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AddRepoDialog } from "@/components/layout/add-repo-dialog";
import { DeleteProjectDialog } from "@/components/shared/delete-project-dialog";
import { UserMenu } from "@/components/layout/user-menu";
import type { RepoConfig } from "@/lib/types";

const SUPER_ADMIN_EMAIL = "dev@dahmani.fr";

interface AppSidebarProps {
  repos: RepoConfig[];
  userEmail?: string;
  localFsEnabled?: boolean;
  githubEnabled?: boolean;
}

const projectTabs = [
  { label: "Overview", segment: "", icon: Eye },
  { label: "Epics", segment: "epics", icon: Map },
  { label: "Stories", segment: "stories", icon: BookOpen },
  { label: "Library", segment: "docs", icon: FileText },
  { label: "BMad Control", segment: "control", icon: Bot, isBmad: true },
  { label: "Models & Providers", segment: "models", icon: Cpu, isBmad: true },
];

function ProjectIcon({
  sourceType,
  className = "h-4 w-4",
}: {
  sourceType: RepoConfig["sourceType"];
  className?: string;
}) {
  return sourceType === "local" ? (
    <FolderOpen className={className} />
  ) : (
    <FolderGit2 className={className} />
  );
}

export function AppSidebar({
  repos,
  userEmail,
  localFsEnabled,
  githubEnabled,
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Deduplicate repos by owner/name and normalize paths
  const uniqueRepos = useMemo(() => {
    const seen = new Set<string>();
    return repos.filter((r) => {
      const key = `${r.owner}/${r.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [repos]);

  const activeProject = useMemo(
    () =>
      uniqueRepos.find((repo) =>
        pathname.startsWith(`/repo/${repo.owner}/${repo.name}`)
      ),
    [uniqueRepos, pathname]
  );

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switcherQuery, setSwitcherQuery] = useState("");
  // Track project expansion state (active project expanded by default)
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});

  const isProjectExpanded = (key: string) => {
    if (expandedProjects[key] !== undefined) {
      return expandedProjects[key];
    }
    // Default: expanded if active project
    return activeProject ? `${activeProject.owner}/${activeProject.name}` === key : false;
  };

  const toggleProjectExpanded = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedProjects((prev) => ({
      ...prev,
      [key]: !isProjectExpanded(key),
    }));
  };

  const matchingProjects = useMemo(() => {
    const query = switcherQuery.trim().toLowerCase();
    if (!query) return uniqueRepos;
    return uniqueRepos.filter((repo) =>
      [repo.displayName, repo.owner, repo.name, repo.description, repo.localPath]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [switcherQuery, uniqueRepos]);

  const selectProject = (repo: RepoConfig) => {
    setSwitcherOpen(false);
    setSwitcherQuery("");
    setExpandedProjects((prev) => ({
      ...prev,
      [`${repo.owner}/${repo.name}`]: true,
    }));
    router.push(`/repo/${repo.owner}/${repo.name}`);
  };

  return (
    <Sidebar variant="floating" collapsible="icon" className="group-data-[collapsible=icon]:p-2">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3 group-data-[collapsible=icon]:px-1">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-info text-white shadow-sm">
            <Workflow className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-sm font-semibold">BmadManager</span>
            <span className="block truncate text-xs text-muted-foreground">Project workspace</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3 group-data-[collapsible=icon]:px-1">
        {/* Workspace section */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/"}
                  tooltip="Dashboard"
                  className="h-9 rounded-lg data-[active=true]:bg-info data-[active=true]:text-white font-medium"
                >
                  <Link href="/">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                    {uniqueRepos.length > 0 && (
                      <span className="ml-auto rounded-full bg-sidebar-border/60 px-1.5 py-0.5 text-2xs font-semibold group-data-[collapsible=icon]:hidden">
                        {uniqueRepos.length}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Projects section */}
        <SidebarGroup className="mt-4 p-0">
          <div className="flex items-center justify-between px-2 pb-1.5">
            <SidebarGroupLabel className="h-auto p-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Projects ({uniqueRepos.length})
            </SidebarGroupLabel>
            <div className="group-data-[collapsible=icon]:hidden">
              <AddRepoDialog
                importedRepos={uniqueRepos}
                localFsEnabled={localFsEnabled}
                githubEnabled={githubEnabled}
                trigger={
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                    title="Add new project"
                    aria-label="Add project"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                }
              />
            </div>
          </div>

          <SidebarGroupContent>
            {/* Quick Switcher Trigger (Popover) */}
            <Popover open={switcherOpen} onOpenChange={setSwitcherOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="mt-1 mb-2 flex h-9 w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar/80 px-2.5 text-left text-xs shadow-xs transition-colors hover:border-info/40 hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
                  title="Quick project switcher"
                >
                  {activeProject ? (
                    <ProjectIcon sourceType={activeProject.sourceType} className="h-3.5 w-3.5 shrink-0 text-info" />
                  ) : (
                    <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground group-data-[collapsible=icon]:hidden">
                    {activeProject?.displayName ?? "Switch / Jump to project..."}
                  </span>
                  <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                </button>
              </PopoverTrigger>

              <PopoverContent
                className="w-72 p-2 shadow-lg border border-border/80"
                align="start"
                sideOffset={4}
              >
                <div className="mb-2 relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    autoFocus
                    value={switcherQuery}
                    onChange={(e) => setSwitcherQuery(e.target.value)}
                    placeholder="Search projects..."
                    className="h-8 pl-8 text-xs"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1">
                  {matchingProjects.length > 0 ? (
                    matchingProjects.map((repo) => {
                      const isCurrent =
                        activeProject?.owner === repo.owner && activeProject?.name === repo.name;
                      const duplicateNameCount = uniqueRepos.filter(
                        (r) => r.displayName.toLowerCase() === repo.displayName.toLowerCase()
                      ).length;
                      const disambiguationHint =
                        duplicateNameCount > 1
                          ? repo.localPath
                            ? repo.localPath.startsWith("/")
                              ? "Docker"
                              : "Host"
                            : repo.sourceType
                          : null;

                      return (
                        <div
                          key={`${repo.owner}/${repo.name}`}
                          className={`group/popover-row flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-info/10 ${
                            isCurrent ? "bg-info/10 font-semibold text-info" : "text-foreground"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => selectProject(repo)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <ProjectIcon
                              sourceType={repo.sourceType}
                              className={`h-3.5 w-3.5 shrink-0 ${isCurrent ? "text-info" : "text-muted-foreground"}`}
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {repo.displayName}
                              {disambiguationHint && (
                                <span className="ml-1 text-3xs font-mono text-muted-foreground">
                                  ({disambiguationHint})
                                </span>
                              )}
                            </span>
                            {isCurrent && <Check className="h-3.5 w-3.5 shrink-0 text-info" />}
                          </button>

                          <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                            <DeleteProjectDialog
                              owner={repo.owner}
                              name={repo.name}
                              displayName={repo.displayName}
                              sourceType={repo.sourceType}
                              trigger={
                                <button
                                  type="button"
                                  className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover/popover-row:opacity-100 transition-all"
                                  title="Remove project"
                                  aria-label="Remove project"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              }
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-4 text-center text-xs text-muted-foreground">
                      No matching projects
                    </div>
                  )}
                </div>

                <div className="mt-2 border-t border-border/60 pt-2">
                  <AddRepoDialog
                    importedRepos={uniqueRepos}
                    localFsEnabled={localFsEnabled}
                    githubEnabled={githubEnabled}
                    trigger={
                      <button
                        type="button"
                        onClick={() => setSwitcherOpen(false)}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-info transition-colors hover:bg-info/10"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add new project...</span>
                      </button>
                    }
                  />
                </div>
              </PopoverContent>
            </Popover>

            {/* Direct Project List */}
            {uniqueRepos.length > 0 ? (
              <SidebarMenu className="gap-1">
                {uniqueRepos.map((repo) => {
                  const projectKey = `${repo.owner}/${repo.name}`;
                  const isCurrent =
                    activeProject?.owner === repo.owner && activeProject.name === repo.name;
                  const expanded = isProjectExpanded(projectKey);

                  const duplicateNameCount = uniqueRepos.filter(
                    (r) => r.displayName.toLowerCase() === repo.displayName.toLowerCase()
                  ).length;
                  const disambiguationHint =
                    duplicateNameCount > 1
                      ? repo.localPath
                        ? repo.localPath.startsWith("/")
                          ? "Docker"
                          : "Host"
                        : repo.sourceType
                      : null;

                  return (
                    <SidebarMenuItem key={projectKey}>
                      <div className="flex items-center gap-1 group/project-row">
                        <SidebarMenuButton
                          asChild
                          isActive={isCurrent}
                          tooltip={`${repo.displayName}${disambiguationHint ? ` (${disambiguationHint})` : ""}`}
                          className={`h-9 flex-1 rounded-lg transition-colors ${
                            isCurrent
                              ? "bg-info/10 font-semibold text-info"
                              : "text-foreground/80 hover:bg-sidebar-accent hover:text-foreground"
                          }`}
                        >
                          <Link href={`/repo/${repo.owner}/${repo.name}`}>
                            <ProjectIcon
                              sourceType={repo.sourceType}
                              className={`h-4 w-4 shrink-0 ${isCurrent ? "text-info" : "text-muted-foreground"}`}
                            />
                            <span className="truncate">{repo.displayName}</span>
                            {disambiguationHint && (
                              <span className="ml-1 rounded bg-muted/80 px-1 py-0.25 text-3xs text-muted-foreground font-mono group-data-[collapsible=icon]:hidden">
                                {disambiguationHint}
                              </span>
                            )}
                            {isCurrent && (
                              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-info/20 px-1.5 py-0.25 text-3xs font-medium text-info group-data-[collapsible=icon]:hidden">
                                <span className="h-1.5 w-1.5 rounded-full bg-info animate-pulse" />
                                Active
                              </span>
                            )}
                          </Link>
                        </SidebarMenuButton>

                        {/* Remove / Uninstall project button */}
                        <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                          <DeleteProjectDialog
                            owner={repo.owner}
                            name={repo.name}
                            displayName={repo.displayName}
                            sourceType={repo.sourceType}
                            trigger={
                              <button
                                type="button"
                                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover/project-row:opacity-100 transition-all group-data-[collapsible=icon]:hidden"
                                title="Remove or uninstall project"
                                aria-label="Remove project"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            }
                          />
                        </div>

                        {/* Chevron to collapse/expand sub-navigation */}
                        {isCurrent && (
                          <button
                            type="button"
                            onClick={(e) => toggleProjectExpanded(projectKey, e)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground group-data-[collapsible=icon]:hidden"
                            title={expanded ? "Collapse menu" : "Expand menu"}
                            aria-label={expanded ? "Collapse menu" : "Expand menu"}
                          >
                            {expanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Expanded Work Tabs for Active Project */}
                      {isCurrent && expanded && (
                        <SidebarMenuSub className="mt-1 mb-2 ml-4 border-l-2 border-info/30 pl-2 space-y-0.5">
                          {projectTabs.map((tab) => {
                            const basePath = `/repo/${repo.owner}/${repo.name}`;
                            const href = tab.segment ? `${basePath}/${tab.segment}` : basePath;
                            const isTabActive =
                              tab.segment === ""
                                ? pathname === basePath || pathname === `${basePath}/`
                                : pathname.startsWith(`${basePath}/${tab.segment}`);

                            return (
                              <SidebarMenuSubItem key={tab.segment || "overview"}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={isTabActive}
                                  className={`h-8 rounded-md text-xs transition-colors ${
                                    isTabActive
                                      ? "bg-info/15 font-semibold text-info"
                                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                                  }`}
                                >
                                  <Link
                                    href={href}
                                    onClick={() => {
                                      if (isTabActive) {
                                        window.dispatchEvent(new CustomEvent("section-reset"));
                                      }
                                    }}
                                  >
                                    <tab.icon className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{tab.label}</span>
                                    {tab.isBmad && (
                                      <span className="ml-auto rounded bg-info/20 px-1 py-0.25 text-3xs font-semibold text-info">
                                        BMAD
                                      </span>
                                    )}
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            ) : (
              <div className="px-2 py-4 text-center rounded-lg border border-dashed border-sidebar-border group-data-[collapsible=icon]:hidden">
                <p className="text-xs text-muted-foreground mb-2">No projects added yet</p>
                <AddRepoDialog
                  importedRepos={uniqueRepos}
                  localFsEnabled={localFsEnabled}
                  githubEnabled={githubEnabled}
                  trigger={
                    <Button size="xs" variant="outline" className="text-xs gap-1">
                      <Plus className="h-3 w-3" />
                      Add project
                    </Button>
                  }
                />
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 border-t border-sidebar-border p-3 group-data-[collapsible=icon]:p-1">
        <div className="group-data-[collapsible=icon]:hidden">
          <AddRepoDialog
            importedRepos={uniqueRepos}
            localFsEnabled={localFsEnabled}
            githubEnabled={githubEnabled}
            trigger={
              <Button
                size="sm"
                className="h-9 w-full justify-start gap-2 rounded-lg bg-info text-white shadow-xs hover:bg-info/90 font-medium"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add project</span>
              </Button>
            }
          />
        </div>
        {userEmail === SUPER_ADMIN_EMAIL && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full justify-start gap-2 rounded-lg group-data-[collapsible=icon]:hidden"
            asChild
          >
            <Link href="/admin">
              <Shield className="h-4 w-4" aria-hidden="true" />
              <span>Admin</span>
            </Link>
          </Button>
        )}
        <div className="border-t border-sidebar-border pt-2">
          <UserMenu />
        </div>
        <p className="px-1 text-center text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          BmadManager · pouya samie
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}