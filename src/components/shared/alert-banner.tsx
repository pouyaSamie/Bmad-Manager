"use client";
import { Alert } from "@mantine/core";
export function AlertBanner({
  variant = "error",
  title,
  children,
}: {
  variant?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <Alert
      title={title}
      color={
        variant === "error"
          ? "red"
          : variant === "warning"
            ? "orange"
            : "indigo"
      }
    >
      {children}
    </Alert>
  );
}
