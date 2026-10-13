"use client";
import { Badge as MantineBadge } from "@mantine/core";
export function Badge({
  variant,
  children,
  className,
  ...rest
}: React.ComponentProps<"span"> & { variant?: string }) {
  return (
    <MantineBadge
      component="span"
      variant={variant === "outline" ? "outline" : "light"}
      className={className}
      {...rest}
    >
      {children}
    </MantineBadge>
  );
}
