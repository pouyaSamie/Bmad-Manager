"use client";

import Link from "next/link";
import { ProgressRing } from "@/components/shared/progress-ring";
import { ParseErrorsDialog } from "@/components/shared/parse-errors-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { WorkItemBadge } from "@/components/shared/work-item-badge";
import { DeleteProjectDialog } from "@/components/shared/delete-project-dialog";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronRight, FolderOpen, GitBranch, Layers, Trash2 } from "lucide-react";
import type { BmadProject, Epic } from "@/lib/bmad/types";
import { getEpicShortId } from "@/lib/bmad/utils";

interface RepoCardProps {
  project: BmadProject;
  description: string | null;
}

function getBarColor(percent: number) {
  if (percent >= 75) return "bg-success";
  if (percent >= 40) return "bg-info";
  return "bg-warning";
}

function EpicSummaryRow({ epic }: { epic: Epic }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-t border-border/60 py-2 first:border-t-0">
      <span className="font-mono text-xs text-muted-foreground">{getEpicShortId(epic)}</span>
      <span className="truncate text-sm" title={`${epic.id}. ${epic.title}`}>{epic.title}</span>
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-14 overflow-hidden rounded-sm bg-muted" aria-label={`${epic.progressPercent}% complete`}>
          <div className={`h-full ${getBarColor(epic.progressPercent)}`} style={{ width: `${epic.progressPercent}%` }} />
        </div>
        <StatusBadge status={epic.status} compact />
      </div>
    </div>
  );
}

export function RepoCard({ project, description }: RepoCardProps) {
  const visibleEpics = project.epics.slice(0, 3);
  const remainingEpics = Math.max(0, project.epics.length - visibleEpics.length);

  return (
    <div className="group relative h-full">
      <Link href={`/repo/${project.owner}/${project.repo}`} className="block h-full">
        <article className="h-full overflow-hidden rounded-md border bg-card shadow-sm transition-colors hover:border-info/60 hover:bg-info/5">
          <div className="flex items-start justify-between gap-4 border-b border-border/70 p-4">
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-base font-semibold group-hover:text-info">{project.displayName}</h2>
                {(project.parseHealth?.errors.length ?? 0) > 0 && <ParseErrorsDialog errors={project.parseHealth?.errors ?? []} />}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                {project.owner === "local" ? <FolderOpen className="h-3.5 w-3.5" /> : <GitBranch className="h-3.5 w-3.5" />}
                <span className="truncate">{project.owner === "local" ? "Local project" : `${project.owner}/${project.repo}`}</span>
              </div>
              {description && <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">{description}</p>}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <ProgressRing percent={project.progressPercent} size={48} strokeWidth={4} />
            </div>
          </div>

          <div className="p-4">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" />{project.epics.length} epics</span>
              <span className="inline-flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" />{project.totalStories} stories</span>
              <span className="ml-auto font-medium text-foreground">{project.completedStories} done</span>
            </div>

            {visibleEpics.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <WorkItemBadge type="epic" /> Delivery plan
                </div>
                {visibleEpics.map((epic) => <EpicSummaryRow key={epic.id} epic={epic} />)}
                {remainingEpics > 0 && <p className="pt-2 text-xs font-medium text-info">+{remainingEpics} more epics</p>}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border/70 px-4 py-2 text-xs font-medium text-info">
            <span className="text-xs text-muted-foreground font-normal">Click to open</span>
            <span className="flex items-center">Open project <ChevronRight className="ml-1 h-3.5 w-3.5" /></span>
          </div>
        </article>
      </Link>

      {/* Direct Remove / Uninstall Button on Card */}
      <div className="absolute top-3.5 right-16 z-10" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        <DeleteProjectDialog
          owner={project.owner}
          name={project.repo}
          displayName={project.displayName}
          sourceType={project.owner === "local" ? "local" : "github"}
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 opacity-40 hover:opacity-100 group-hover:opacity-80 transition-all"
              title="Remove or uninstall project"
              aria-label="Remove or uninstall project"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          }
        />
      </div>
    </div>
  );
}