import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { WorkItemBadge } from "@/components/shared/work-item-badge";
import { SegmentedProgressBar } from "@/components/shared/segmented-progress-bar";
import type { Epic } from "@/lib/bmad/types";
import { getEpicShortId } from "@/lib/bmad/utils";

function getProgressColor(percent: number) {
  return percent >= 100 ? "bg-success" : percent > 0 ? "bg-info" : "bg-muted-foreground";
}

interface EpicTimelineCardProps {
  epic: Epic;
  onClick?: () => void;
}

export function EpicTimelineCard({ epic, onClick }: EpicTimelineCardProps) {
  return (
    <Card
      className={`rounded-md border bg-card py-0 shadow-sm${onClick ? " cursor-pointer transition-colors hover:border-info/60 hover:bg-info/5" : ""}`}
      onClick={onClick}
      {...(onClick && {
        role: "button" as const,
        tabIndex: 0,
        onKeyDown: (event: React.KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick();
          }
        },
      })}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><WorkItemBadge type="epic" /><span className="font-mono text-xs text-muted-foreground">{getEpicShortId(epic)}</span><h3 className="min-w-0 text-sm font-semibold">{epic.title}</h3></div>
            {epic.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{epic.description}</p>}
          </div>
          <StatusBadge status={epic.status} compact />
        </div>
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div><div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground"><span>{epic.completedStories} of {epic.totalStories} stories complete</span><span>{epic.progressPercent}%</span></div><SegmentedProgressBar percent={epic.progressPercent} color={getProgressColor(epic.progressPercent)} className="h-1.5" /></div>
          <span className="text-xs font-medium text-muted-foreground">View work items</span>
        </div>
      </CardContent>
    </Card>
  );
}