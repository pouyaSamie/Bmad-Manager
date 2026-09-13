import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { WorkItemBadge } from "@/components/shared/work-item-badge";
import { SegmentedProgressBar } from "@/components/shared/segmented-progress-bar";
import { ChevronRight, Info } from "lucide-react";
import type { Epic } from "@/lib/bmad/types";
import { compareIds, getEpicShortId } from "@/lib/bmad/utils";

interface EpicsListProps {
  epics: Epic[];
  owner: string;
  repo: string;
}

function getProgressColor(percent: number) {
  return percent >= 100 ? "bg-success" : percent > 0 ? "bg-info" : "bg-muted-foreground";
}

export function EpicsList({ epics, owner, repo }: EpicsListProps) {
  if (epics.length === 0) {
    return (
      <Card className="rounded-md border bg-card py-0 shadow-sm">
        <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <Info className="h-5 w-5 shrink-0" />
          <span>No epics found in this project.</span>
        </CardContent>
      </Card>
    );
  }

  const sorted = [...epics].sort((a, b) => compareIds(a.id, b.id));

  return (
    <section className="overflow-hidden rounded-md border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold">Epics</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Portfolio backlog</p>
        </div>
        <span className="text-xs font-medium text-muted-foreground">{sorted.length} work items</span>
      </div>
      <div className="hidden grid-cols-[auto_minmax(0,1fr)_minmax(12rem,16rem)_auto_auto] gap-4 border-b border-border/70 bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
        <span>Type</span><span>Title</span><span>Progress</span><span>State</span><span aria-label="Open" />
      </div>
      <CardContent className="p-0">
        {sorted.map((epic) => (
          <Link
            key={epic.id}
            href={`/repo/${owner}/${repo}/epics`}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0 transition-colors hover:bg-info/5 md:grid-cols-[auto_minmax(0,1fr)_minmax(12rem,16rem)_auto_auto] md:gap-4"
          >
            <div className="flex items-center gap-2"><WorkItemBadge type="epic" /><span className="font-mono text-xs text-muted-foreground">{getEpicShortId(epic)}</span></div>
            <div className="min-w-0"><p className="truncate text-sm font-medium">{epic.title}</p>{epic.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{epic.description}</p>}</div>
            <div className="hidden min-w-0 md:block"><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{epic.completedStories}/{epic.totalStories} stories</span><span>{epic.progressPercent}%</span></div><SegmentedProgressBar percent={epic.progressPercent} color={getProgressColor(epic.progressPercent)} className="h-1.5" /></div>
            <StatusBadge status={epic.status} compact />
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </Link>
        ))}
      </CardContent>
    </section>
  );
}