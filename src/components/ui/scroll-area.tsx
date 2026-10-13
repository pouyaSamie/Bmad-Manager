"use client";
import { ScrollArea as MantineScrollArea } from "@mantine/core";
export function ScrollArea({
  children,
  className,
  type,
  ...rest
}: React.ComponentProps<"div"> & {
  type?: "auto" | "always" | "scroll" | "hover" | "never";
}) {
  return (
    <MantineScrollArea className={className} type={type} {...rest}>
      {children}
    </MantineScrollArea>
  );
}
export function ScrollBar(_props: {
  orientation?: string;
  className?: string;
}) {
  void _props;
  return null;
}
