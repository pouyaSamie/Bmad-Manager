import { StatsCard } from "@/components/shared/stats-card";
import { StaggeredList, StaggeredItem } from "@/components/shared/staggered-list";
import { Layers, BookOpen, CheckCircle2, Zap } from "lucide-react";

interface ProjectStatsGridProps {
  totalEpics: number;
  totalStories: number;
  completedStories: number;
  sprintProgress: number | null;
}

export function ProjectStatsGrid({
  totalEpics,
  totalStories,
  completedStories,
  sprintProgress,
}: ProjectStatsGridProps) {
  return (
    <StaggeredList className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <StaggeredItem>
        <StatsCard
          title="Epics"
          value={totalEpics}
          icon={Layers}
          color="violet"
          description="Total epics"
        />
      </StaggeredItem>
      <StaggeredItem>
        <StatsCard
          title="Stories"
          value={totalStories}
          icon={BookOpen}
          color="info"
          description="Total stories"
        />
      </StaggeredItem>
      <StaggeredItem>
        <StatsCard
          title="Completed"
          value={completedStories}
          icon={CheckCircle2}
          color="success"
          description="Completed stories"
        />
      </StaggeredItem>
      <StaggeredItem>
        <StatsCard
          title="Sprint"
          value={sprintProgress !== null ? `${sprintProgress}%` : "—"}
          icon={Zap}
          color="warning"
          description={
            sprintProgress !== null ? "Sprint progress" : "No sprint defined"
          }
        />
      </StaggeredItem>
    </StaggeredList>
  );
}
