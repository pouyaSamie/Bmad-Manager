import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { MarkdownRenderer } from "@/components/docs/markdown-renderer";
import { CheckCircle2, Circle } from "lucide-react";
import { SegmentedProgressBar } from "@/components/shared/segmented-progress-bar";
import type { StoryDetail } from "@/lib/bmad/types";

interface StoryDetailViewProps {
  story: StoryDetail;
}

export function StoryDetailView({ story }: StoryDetailViewProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
            Story {story.id}
          </span>
          <h3 className="text-lg font-semibold">{story.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {story.agent && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium">
              <span className="text-sm">{story.agent.icon || "🤖"}</span>
              <span className="font-semibold text-foreground">{story.agent.name}</span>
              {story.agent.title && (
                <span className="text-muted-foreground text-xs">· {story.agent.title}</span>
              )}
            </span>
          )}
          <StatusBadge status={story.status} />
        </div>
      </div>

      {/* Description */}
      {story.description && (
        <Card className="glass-card">
          <CardContent className="p-5">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Description
            </h4>
            <MarkdownRenderer content={story.description} />
          </CardContent>
        </Card>
      )}

      {/* Acceptance Criteria */}
      {story.acceptanceCriteria.length > 0 && (
        <Card className="glass-card">
          <CardContent className="p-5">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Acceptance Criteria
            </h4>
            <ul className="space-y-2">
              {story.acceptanceCriteria.map((criterion, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 text-muted-foreground">•</span>
                  <span>{criterion}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Tasks */}
      <Card className="glass-card">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Tasks
            </h4>
            <span className="text-xs text-muted-foreground">
              {story.totalTasks > 0
                ? `${story.completedTasks} of ${story.totalTasks} completed`
                : "0 tasks"}
            </span>
          </div>
          {story.tasks.length > 0 ? (
            <>
              <SegmentedProgressBar
                percent={story.totalTasks > 0 ? Math.round((story.completedTasks / story.totalTasks) * 100) : 0}
                color={story.completedTasks === story.totalTasks ? "bg-success" : "bg-warning"}
                className="h-2 mb-4"
              />
              <ul className="space-y-2">
                {story.tasks.map((task, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    {task.completed ? (
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-success shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    )}
                    <span className={task.completed ? "text-muted-foreground line-through" : ""}>
                      {task.description}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No task checklist items defined for this story.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
