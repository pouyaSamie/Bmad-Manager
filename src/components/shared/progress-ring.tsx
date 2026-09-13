"use client";

import { cn } from "@/lib/utils";

interface ProgressRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function getProgressColor(percent: number) {
  if (percent >= 75) return { stroke: "stroke-success", fill: "fill-success-foreground" };
  if (percent >= 40) return { stroke: "stroke-warning", fill: "fill-warning-foreground" };
  return { stroke: "stroke-destructive", fill: "fill-destructive-foreground" };
}

export function ProgressRing({
  percent,
  size = 48,
  strokeWidth = 4,
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;
  const colors = getProgressColor(percent);

  return (
    <svg width={size} height={size} className={className} role="img" aria-label={`${percent}% complete`}>
      <circle
        className="stroke-muted"
        fill="none"
        strokeWidth={strokeWidth}
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
      <circle
        className={cn(colors.stroke, "transition-all duration-700 ease-out")}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        r={radius}
        cx={size / 2}
        cy={size / 2}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dy=".3em"
        className={cn("text-xs font-semibold", colors.fill)}
      >
        {percent}%
      </text>
    </svg>
  );
}
