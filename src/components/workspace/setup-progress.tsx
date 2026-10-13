"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Paper, Title, Text, Stack, Group, Badge, Button } from "@mantine/core";
import { getBmadControl } from "@/actions/bmad-control-actions";
import { listConnections } from "@/actions/connection-actions";
import type { StudioData } from "./studio-types";
export function SetupProgress({
  owner,
  name,
}: {
  owner: string;
  name: string;
}) {
  const [state, setState] = useState<{
    data: StudioData;
    connected: boolean;
    tested: boolean;
  } | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all([getBmadControl({ owner, name }), listConnections()]).then(
      ([r, c]) => {
        if (active && r.success && c.success) {
          const data = r.data as StudioData;
          const ids = new Set(
            [
              data.runtime.connectionId,
              ...data.agents.map((a) => a.connectionId),
            ].filter(Boolean),
          );
          const relevant = c.data.filter((x) => ids.has(x.id));
          setState({
            data,
            connected: c.data.some((x) => x.models?.length),
            tested: relevant.some((x) => x.status === "tested"),
          });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [owner, name]);
  if (!state) return null;
  const base = "/repo/" + owner + "/" + name;
  const steps = [
    {
      title: "Inspect installation",
      done: state.data.runtime.installStatus === "ready",
      href: base + "/settings",
    },
    {
      title: "Verify a connection",
      done: state.connected,
      href: "/connections",
    },
    {
      title: "Choose project default",
      done: !!state.data.runtime.connectionId && !!state.data.runtime.modelId,
      href: base + "/settings",
    },
    {
      title: "Test your first agent",
      done: state.tested,
      href: base + "/agents",
    },
    {
      title: "Design a workflow",
      done: !!(state.data.runtime.workflow as { nodes?: unknown[] } | null)
        ?.nodes?.length,
      href: base + "/workflow",
    },
  ];
  const next = steps.find((s) => !s.done);
  return (
    <Paper withBorder p="xl">
      <Stack>
        <Group justify="space-between">
          <div>
            <Title order={3}>Project setup</Title>
            <Text c="dimmed" size="sm">
              {steps.filter((s) => s.done).length} of {steps.length} steps
              complete
            </Text>
          </div>
          {next && (
            <Button component={Link} href={next.href}>
              {next.title}
            </Button>
          )}
        </Group>
        {steps.map((s) => (
          <Group key={s.title} justify="space-between">
            <Text size="sm">{s.title}</Text>
            <Badge color={s.done ? "green" : "gray"}>
              {s.done ? "Complete" : "Next"}
            </Badge>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}
