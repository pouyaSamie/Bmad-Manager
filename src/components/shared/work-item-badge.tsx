import { cn } from "@/lib/utils";

type WorkItemType = "epic" | "story";

const typeStyles: Record<WorkItemType, { label: string; className: string }> = {
  epic: {
    label: "Epic",
    className: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
  story: {
    label: "User Story",
    className: "bg-info/15 text-info-foreground",
  },
};

interface WorkItemBadgeProps {
  type: WorkItemType;
  className?: string;
}

export function WorkItemBadge({ type, className }: WorkItemBadgeProps) {
  const config = typeStyles[type];

  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-sm px-1.5 text-xs font-semibold uppercase tracking-wide",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}