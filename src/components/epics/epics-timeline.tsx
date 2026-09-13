import { Check, Loader2, Circle } from "lucide-react";
import { EpicTimelineCard } from "./epic-timeline-card";
import { StaggeredList, StaggeredItem } from "@/components/shared/staggered-list";
import type { Epic } from "@/lib/bmad/types";

interface EpicsTimelineProps {
  epics: Epic[];
  onSelectEpic?: (epicId: string) => void;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "done") {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-success text-white shadow-sm shadow-success/30">
        <Check className="h-4 w-4" strokeWidth={3} />
      </div>
    );
  }
  if (status === "in-progress") {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-info bg-background">
        <Loader2 className="h-3.5 w-3.5 text-info animate-spin" />
      </div>
    );
  }
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-muted-foreground/30 bg-background">
      <Circle className="h-3 w-3 text-muted-foreground/40" />
    </div>
  );
}

function connectorColor(status: string) {
  if (status === "done") return "bg-success";
  if (status === "in-progress") return "bg-info/40";
  return "bg-border";
}

export function EpicsTimeline({ epics, onSelectEpic }: EpicsTimelineProps) {
  if (epics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium text-muted-foreground">
          No epic found
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Epics will appear here once defined in the planning artifacts.
        </p>
      </div>
    );
  }

  return (
    <StaggeredList className="space-y-0" staggerDelay={0.08}>
      {epics.map((epic, i) => (
        <StaggeredItem key={epic.id}>
          <div className="flex gap-4">
            {/* Stepper column */}
            <div className="flex flex-col items-center">
              {/* Top connector */}
              <div
                className={`w-0.5 flex-1 ${i === 0 ? "bg-transparent" : connectorColor(epics[i - 1].status)}`}
              />
              {/* Status icon */}
              <StatusIcon status={epic.status} />
              {/* Bottom connector */}
              <div
                className={`w-0.5 flex-1 ${i === epics.length - 1 ? "bg-transparent" : connectorColor(epic.status)}`}
              />
            </div>

            {/* Card */}
            <div className="flex-1 py-2">
              <EpicTimelineCard
                epic={epic}
                onClick={onSelectEpic ? () => onSelectEpic(epic.id) : undefined}
              />
            </div>
          </div>
        </StaggeredItem>
      ))}
    </StaggeredList>
  );
}
