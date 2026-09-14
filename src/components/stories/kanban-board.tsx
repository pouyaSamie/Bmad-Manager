"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkItemBadge } from "@/components/shared/work-item-badge";
import { StaggeredList, StaggeredItem } from "@/components/shared/staggered-list";
import { ListTodo } from "lucide-react";
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

interface KanbanBoardProps {
  stories: StoryDetail[];
  onSelectStory?: (story: StoryDetail) => void;
}

export function KanbanBoard({ stories, onSelectStory }: KanbanBoardProps) {
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
                <Card
                  key={story.id}
                  onClick={() => onSelectStory?.(story)}
                  className="cursor-pointer rounded-md border bg-card py-0 shadow-sm transition-all hover:border-info/60 hover:bg-info/5 hover:shadow-md"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectStory?.(story);
                    }
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <WorkItemBadge type="story" />
                        <span className="font-mono text-xs text-muted-foreground">{story.id}</span>
                      </div>
                      {story.status === "in-progress" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-info">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-info" />
                          </span>
                          Active
                        </span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm font-medium leading-5">{story.title}</p>
                    {story.epicTitle && <p className="mt-1.5 truncate text-xs text-muted-foreground">{story.epicTitle}</p>}
                    {story.agent && (
                      <div className="mt-2.5 flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/40 px-2 py-1 text-xs">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background text-xs shadow-xs" title={`${story.agent.name}${story.agent.title ? ` (${story.agent.title})` : ""}`}>
                          {story.agent.icon || "🤖"}
                        </span>
                        <span className="truncate font-medium text-foreground">{story.agent.name}</span>
                        {story.agent.title && (
                          <span className="truncate text-xs text-muted-foreground">· {story.agent.title}</span>
                        )}
                      </div>
                    )}
                    {story.totalTasks > 0 && (
                      <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <ListTodo className="h-3.5 w-3.5" />
                          <span>Tasks</span>
                        </span>
                        <span className="font-medium tabular-nums">{story.completedTasks}/{story.totalTasks}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {columnStories.length === 0 && <div className="flex h-20 items-center justify-center border border-dashed bg-background/50 text-xs text-muted-foreground">No stories</div>}
            </div>
          </StaggeredItem>
        );
      })}
    </StaggeredList>
  );
}