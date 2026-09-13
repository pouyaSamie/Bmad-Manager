import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  className?: string;
  color?: "primary" | "info" | "success" | "warning" | "destructive" | "violet";
}

const colorStyles = {
  primary: { border: "border-l-primary", icon: "text-primary" },
  violet: { border: "border-l-violet-500", icon: "text-violet-600 dark:text-violet-400" },
  info: { border: "border-l-info", icon: "text-info" },
  success: { border: "border-l-success", icon: "text-success" },
  warning: { border: "border-l-warning", icon: "text-warning" },
  destructive: { border: "border-l-destructive", icon: "text-destructive" },
};

export function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  className,
  color = "primary",
}: StatsCardProps) {
  const style = colorStyles[color];

  return (
    <Card className={cn("rounded-md border-l-4 bg-card py-0 shadow-sm", style.border, className)}>
      <CardContent className="flex min-h-24 items-center gap-3 p-4">
        <Icon className={cn("h-5 w-5 shrink-0", style.icon)} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          {description && <p className="mt-1 truncate text-xs text-muted-foreground">{description}</p>}
        </div>
      </CardContent>
    </Card>
  );
}