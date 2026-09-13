"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkItemBadge } from "@/components/shared/work-item-badge";
import { StaggeredList, StaggeredItem } from "@/components/shared/staggered-list";
import type { StoryDetail, StoryStatus } from "@/lib/bmad/types";
import { getStoryShortId } from "@/lib/bmad/utils";

const kanbanColumns: { status: StoryStatus; label: string; color: string }[] = [
  { status: "backlog", label: "New", color: "bg-muted-foreground" },
  { status: "ready-for-dev", label: "Ready", color: "bg-violet-500" },
  { status: "in-progress", label: "Active", color: "bg-info" },
  { status: "review", label: "Resolved", color: "bg-warning" },
  { status: "blocked", label: "Blocked", color: "bg-destructive" },
  { status: "done", label: "Closed", color: "bg-success" },
];

interface KanbanBoardProps { stories: StoryDetail[]; }

export function KanbanBoard({ stories }: KanbanBoardProps) {
  if (stories.length === 0) return <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">No story matches the filters.</div>;

  return (
    <StaggeredList className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
      {kanbanColumns.map((column) => {
        const columnStories = stories.filter((story) => story.status === column.status || (column.status === "backlog" && story.status === "unknown"));
        return (
          <StaggeredItem key={column.status} className="min-w-0 rounded-md bg-muted/45 p-3">
            <div className="flex items-center gap-2 border-b border-border/70 pb-3"><span className={`h-2 w-2 rounded-full ${column.color}`} aria-hidden="true" /><h3 className="text-sm font-semibold">{column.label}</h3><Badge variant="secondary" className="ml-auto rounded-sm text-xs">{columnStories.length}</Badge></div>
            <div className="mt-3 space-y-2">
              {columnStories.map((story) => (
                <Card key={story.id} className="rounded-md border bg-card py-0 shadow-sm transition-colors hover:border-info/60 hover:bg-info/5"><CardContent className="p-3"><div className="flex items-center gap-2"><WorkItemBadge type="story" /><span className="font-mono text-xs text-muted-foreground">{getStoryShortId(story.id)}</span></div><p className="mt-2 line-clamp-3 text-sm font-medium leading-5">{story.title}</p>{story.epicTitle && <p className="mt-2 truncate text-xs text-muted-foreground">{story.epicTitle}</p>}{story.totalTasks > 0 && <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted-foreground"><span>Tasks</span><span className="font-medium">{story.completedTasks}/{story.totalTasks}</span></div>}</CardContent></Card>
              ))}
              {columnStories.length === 0 && <div className="flex h-20 items-center justify-center border border-dashed bg-background/50 text-xs text-muted-foreground">No stories</div>}
            </div>
          </StaggeredItem>
        );
      })}
    </StaggeredList>
  );
}