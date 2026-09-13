import { StatsCard } from "@/components/shared/stats-card";
import { StaggeredList, StaggeredItem } from "@/components/shared/staggered-list";
import { TrendingUp, Activity, AlertTriangle } from "lucide-react";
import type { SprintStatus } from "@/lib/bmad/types";

interface VelocityMetricsProps {
  sprintStatus: SprintStatus | null;
}

export function VelocityMetrics({
  sprintStatus,
}: VelocityMetricsProps) {
  if (!sprintStatus) return null;

  const stories = sprintStatus.stories;
  const totalStories = stories.length;
  const doneCount = stories.filter((s) => s.status === "done").length;
  const wipCount = stories.filter(
    (s) => s.status === "in-progress" || s.status === "review",
  ).length;
  const blockedCount = stories.filter((s) => s.status === "blocked").length;

  return (
    <StaggeredList className="grid gap-4 grid-cols-3">
      <StaggeredItem>
        <StatsCard
          title="Velocity"
          value={doneCount}
          icon={TrendingUp}
          description={`${totalStories} stories in sprint`}
          color="success"
        />
      </StaggeredItem>
      <StaggeredItem>
        <StatsCard
          title="In Progress (WIP)"
          value={wipCount}
          icon={Activity}
          description="In Progress + Review"
          color="info"
        />
      </StaggeredItem>
      <StaggeredItem>
        <StatsCard
          title="Blocked"
          value={blockedCount}
          icon={AlertTriangle}
          description={blockedCount > 0 ? "Attention required" : "No blockers"}
          color="destructive"
        />
      </StaggeredItem>
    </StaggeredList>
  );
}
