"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Bot, ChevronsUpDown, Eye, FileText, FolderGit2, FolderOpen, LayoutDashboard, Map, Plus, Search, Shield, Workflow } from "lucide-react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AddRepoDialog } from "@/components/layout/add-repo-dialog";
import { UserMenu } from "@/components/layout/user-menu";
import type { RepoConfig } from "@/lib/types";

const SUPER_ADMIN_EMAIL = "dev@dahmani.fr";

interface AppSidebarProps { repos: RepoConfig[]; userEmail?: string; localFsEnabled?: boolean; githubEnabled?: boolean; }

const projectTabs = [
  { label: "Overview", segment: "", icon: Eye },
  { label: "Epics", segment: "epics", icon: Map },
  { label: "Stories", segment: "stories", icon: BookOpen },
  { label: "Library", segment: "docs", icon: FileText },
  { label: "BMad Control", segment: "control", icon: Bot },
];

function ProjectIcon({ sourceType }: { sourceType: RepoConfig["sourceType"] }) {
  return sourceType === "local" ? <FolderOpen className="h-4 w-4" /> : <FolderGit2 className="h-4 w-4" />;
}

export function AppSidebar({ repos, userEmail, localFsEnabled, githubEnabled }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [projectQuery, setProjectQuery] = useState("");
  const activeProject = useMemo(() => repos.find((repo) => pathname.startsWith(`/repo/${repo.owner}/${repo.name}`)), [repos, pathname]);
  const matchingProjects = useMemo(() => {
    const query = projectQuery.trim().toLowerCase();
    if (!query) return repos;
    return repos.filter((repo) => [repo.displayName, repo.owner, repo.name, repo.description, repo.localPath].filter(Boolean).join(" ").toLowerCase().includes(query));
  }, [projectQuery, repos]);

  const selectProject = (repo: RepoConfig) => {
    setPickerOpen(false);
    setProjectQuery("");
    router.push(`/repo/${repo.owner}/${repo.name}`);
  };

  return (
    <Sidebar variant="floating" collapsible="icon" className="group-data-[collapsible=icon]:p-2">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3 group-data-[collapsible=icon]:px-1">
        <Link href="/" className="flex items-center gap-2 rounded-lg outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-info text-white shadow-sm"><Workflow className="h-5 w-5" aria-hidden="true" /></div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden"><span className="block truncate text-sm font-semibold">BmadManager</span><span className="block truncate text-xs text-muted-foreground">Project workspace</span></div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3 group-data-[collapsible=icon]:px-1">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workspace</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu><SidebarMenuItem><SidebarMenuButton asChild isActive={pathname === "/"} tooltip="Dashboard" className="h-9 rounded-lg data-[active=true]:bg-info data-[active=true]:text-white"><Link href="/"><LayoutDashboard className="h-4 w-4" /><span>Dashboard</span></Link></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-3 p-0">
          <SidebarGroupLabel className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Project</SidebarGroupLabel>
          <SidebarGroupContent>
            <Dialog open={pickerOpen} onOpenChange={(open) => { setPickerOpen(open); if (!open) setProjectQuery(""); }}>
              <DialogTrigger asChild>
                <button type="button" className="mt-1 flex h-11 w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar px-2 text-left shadow-sm transition-colors hover:border-info/50 hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0" title="Switch project">
                  {activeProject ? <ProjectIcon sourceType={activeProject.sourceType} /> : <Search className="h-4 w-4" />}
                  <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><span className="block truncate text-sm font-medium">{activeProject?.displayName ?? "Choose a project"}</span><span className="block truncate text-xs text-muted-foreground">{repos.length} projects available</span></span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl p-0" showCloseButton={false}>
                <DialogHeader className="border-b border-border px-5 py-4 text-left"><DialogTitle>Switch project</DialogTitle><DialogDescription>Search across all {repos.length} projects, then open the one you need.</DialogDescription></DialogHeader>
                <div className="border-b border-border p-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus value={projectQuery} onChange={(event) => setProjectQuery(event.target.value)} placeholder="Search by project name, folder, or description" className="pl-9" /></div></div>
                <div className="max-h-96 overflow-y-auto p-2">
                  {matchingProjects.length > 0 ? matchingProjects.map((repo) => {
                    const isCurrent = activeProject?.owner === repo.owner && activeProject.name === repo.name;
                    return <button key={`${repo.owner}/${repo.name}`} type="button" onClick={() => selectProject(repo)} className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-info/10 ${isCurrent ? "bg-info/10" : ""}`}><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><ProjectIcon sourceType={repo.sourceType} /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate text-sm font-medium">{repo.displayName}</span>{isCurrent && <span className="rounded-sm bg-info px-1.5 py-0.5 text-xs font-medium text-white">Current</span>}</div><p className="mt-0.5 truncate text-xs text-muted-foreground">{repo.sourceType === "local" ? repo.localPath ?? "Local project" : `${repo.owner}/${repo.name}`}</p></div><span className="text-xs capitalize text-muted-foreground">{repo.sourceType}</span></button>;
                  }) : <div className="px-3 py-8 text-center text-sm text-muted-foreground">No projects match “{projectQuery}”.</div>}
                </div>
              </DialogContent>
            </Dialog>

            {activeProject ? (
              <SidebarMenu className="mt-3">
                {projectTabs.map((tab) => {
                  const basePath = `/repo/${activeProject.owner}/${activeProject.name}`;
                  const href = tab.segment ? `${basePath}/${tab.segment}` : basePath;
                  const isActive = tab.segment === "" ? pathname === basePath || pathname === `${basePath}/` : pathname.startsWith(`${basePath}/${tab.segment}`);
                  return <SidebarMenuItem key={tab.segment || "overview"}><SidebarMenuButton asChild isActive={isActive} tooltip={tab.label} className="h-9 rounded-lg data-[active=true]:bg-info/10 data-[active=true]:font-semibold data-[active=true]:text-info"><Link href={href} onClick={() => { if (isActive) window.dispatchEvent(new CustomEvent("section-reset")); }}><tab.icon className="h-4 w-4" /><span>{tab.label}</span></Link></SidebarMenuButton></SidebarMenuItem>;
                })}
              </SidebarMenu>
            ) : <p className="px-2 pt-3 text-xs leading-5 text-muted-foreground group-data-[collapsible=icon]:hidden">Choose a project to reveal its work items and controls.</p>}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3 border-t border-sidebar-border p-3 group-data-[collapsible=icon]:p-1">
        <div className="group-data-[collapsible=icon]:hidden"><AddRepoDialog importedRepos={repos} localFsEnabled={localFsEnabled} githubEnabled={githubEnabled} trigger={<Button size="sm" className="h-9 w-full justify-start gap-2 rounded-lg bg-info text-white hover:bg-info/90"><Plus className="h-4 w-4" aria-hidden="true" /><span>Add project</span></Button>} /></div>
        {userEmail === SUPER_ADMIN_EMAIL && <Button variant="outline" size="sm" className="h-9 w-full justify-start gap-2 rounded-lg group-data-[collapsible=icon]:hidden" asChild><Link href="/admin"><Shield className="h-4 w-4" aria-hidden="true" />Admin</Link></Button>}
        <div className="border-t border-sidebar-border pt-2"><UserMenu /></div>
        <p className="px-1 text-center text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">BmadManager · pouya samie</p>
      </SidebarFooter>
    </Sidebar>
  );
}