import { cn } from "@/lib/utils";

interface AlertBannerProps {
  variant?: "warning" | "error";
  title: string;
  children?: React.ReactNode;
  className?: string;
}

const styles = {
  warning: "border-warning/30 bg-warning/5 text-warning-foreground",
  error: "border-destructive/30 bg-destructive/5 text-destructive-foreground",
};

export function AlertBanner({ variant = "warning", title, children, className }: AlertBannerProps) {
  return (
    <div role="alert" className={cn("rounded-lg border p-4", styles[variant], className)}>
      <p className="text-sm font-medium">{title}</p>
      {children}
    </div>
  );
}
