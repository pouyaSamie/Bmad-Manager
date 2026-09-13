"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { WorkItemBadge } from "@/components/shared/work-item-badge";
import { SegmentedProgressBar } from "@/components/shared/segmented-progress-bar";
import { StaggeredList, StaggeredItem } from "@/components/shared/staggered-list";
import type { Epic, EpicStatus } from "@/lib/bmad/types";
import { getEpicShortId } from "@/lib/bmad/utils";

const kanbanColumns: { status: EpicStatus; label: string; color: string }[] = [
  { status: "not-started", label: "To Do", color: "bg-muted-foreground" },
  { status: "in-progress", label: "In Progress", color: "bg-info" },
  { status: "done", label: "Done", color: "bg-success" },
];

interface EpicsKanbanProps {
  epics: Epic[];
  onSelectEpic: (epicId: string) => void;
}

export function EpicsKanban({ epics, onSelectEpic }: EpicsKanbanProps) {
  if (epics.length === 0) {
    return <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">No epics found in this project.</div>;
  }

  return (
    <StaggeredList className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {kanbanColumns.map((column) => {
        const columnEpics = epics.filter((epic) => epic.status === column.status);
        return (
          <StaggeredItem key={column.status} className="min-w-0 rounded-md bg-muted/45 p-3">
            <div className="flex items-center gap-2 border-b border-border/70 pb-3"><span className={`h-2 w-2 rounded-full ${column.color}`} aria-hidden="true" /><h3 className="text-sm font-semibold">{column.label}</h3><Badge variant="secondary" className="ml-auto rounded-sm text-xs">{columnEpics.length}</Badge></div>
            <div className="mt-3 space-y-2">
              {columnEpics.map((epic) => (
                <Card key={epic.id} role="button" tabIndex={0} onClick={() => onSelectEpic(epic.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectEpic(epic.id); } }} className="cursor-pointer rounded-md border bg-card py-0 shadow-sm transition-colors hover:border-info/60 hover:bg-info/5" aria-label={`Open epic ${epic.id}: ${epic.title}`}>
                  <CardContent className="space-y-3 p-3">
                    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="flex items-center gap-2"><WorkItemBadge type="epic" /><span className="font-mono text-xs text-muted-foreground">{getEpicShortId(epic)}</span></div><p className="mt-2 line-clamp-2 text-sm font-medium">{epic.title}</p></div><StatusBadge status={epic.status} compact /></div>
                    <div><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{epic.completedStories}/{epic.totalStories} stories</span><span>{epic.progressPercent}%</span></div><SegmentedProgressBar percent={epic.progressPercent} color={epic.progressPercent >= 100 ? "bg-success" : epic.progressPercent > 0 ? "bg-info" : "bg-muted-foreground"} className="h-1.5" /></div>
                  </CardContent>
                </Card>
              ))}
              {columnEpics.length === 0 && <div className="flex h-20 items-center justify-center border border-dashed bg-background/50 text-xs text-muted-foreground">No epics</div>}
            </div>
          </StaggeredItem>
        );
      })}
    </StaggeredList>
  );
}