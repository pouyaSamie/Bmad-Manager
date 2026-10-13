"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Stack,
  Title,
  Text,
  Paper,
  Button,
  Alert,
  Badge,
  Group,
  SimpleGrid,
} from "@mantine/core";
import { getDiagnostics } from "@/actions/diagnostic-actions";
import { checkConnection } from "@/actions/connection-actions";
import type { ConnectionEvidence } from "@/lib/model-adapters";
export function Diagnostics() {
  const [data, setData] = useState<
      | Extract<
          Awaited<ReturnType<typeof getDiagnostics>>,
          { success: true }
        >["data"]
      | null
    >(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  async function refresh() {
    const r = await getDiagnostics();
    if (r.success) setData(r.data);
    else setError(r.error);
  }
  useEffect(() => {
    void getDiagnostics().then((r) => {
      if (r.success) setData(r.data);
      else setError(r.error);
    });
    const timer = setInterval(() => void refresh(), 10000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Stack gap="xl">
      <Group justify="space-between">
        <div>
          <Title order={1}>Diagnostics</Title>
          <Text c="dimmed">Worker, model connections, and host bridges.</Text>
        </div>
        <Button onClick={refresh}>Refresh diagnostics</Button>
      </Group>
      {error && <Alert color="red">{error}</Alert>}
      <Paper withBorder p="xl">
        <Title order={3}>Repository worker</Title>
        <Badge color={data?.workers.some((w) => w.online) ? "green" : "orange"}>
          {data?.workers.some((w) => w.online) ? "Online" : "Offline"}
        </Badge>
        <Text mt="sm">
          Start pnpm bmad:worker on the host using the app database and
          workspace mapping. Stopped operations require review before retry.
        </Text>
        {data?.workers.map((w, i) => (
          <Text size="sm" key={i}>
            Last seen {new Date(w.lastSeen).toLocaleString()} ·{" "}
            {Object.entries((w.capabilities ?? {}) as Record<string, string>)
              .map(([tool, version]) => tool + ": " + version)
              .join(" · ")}
          </Text>
        ))}
      </Paper>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {data?.connections.map((c) => {
          const e = c.evidence as ConnectionEvidence | null;
          return (
            <Paper withBorder p="xl" key={c.id}>
              <Title order={3}>{c.name}</Title>
              <Text>
                {c.status} · Catalog {e?.catalog?.status ?? "unverified"} ·
                Authentication {e?.authentication?.status ?? "unverified"}
              </Text>
              {e?.bridge && (
                <Text size="sm">
                  Host CLI {e.bridge.provider} · Version{" "}
                  {(e.bridge as { cliVersion?: string }).cliVersion ??
                    "unverified"}{" "}
                  · Login {e.bridge.login} · Restrictions{" "}
                  {e.bridge.restricted ? "verified" : "unverified"}
                </Text>
              )}
              <Text size="sm" c="dimmed">
                {["codex-cli", "agy"].includes(c.provider)
                  ? "Run the host bridge, check login and deny rules, then discover models."
                  : "Check the server endpoint and credential, then test an agent conversation."}
              </Text>
              <Button
                mt="md"
                loading={busy === c.id}
                onClick={async () => {
                  setBusy(c.id);
                  const r = await checkConnection({ id: c.id });
                  if (!r.success) setError(r.error);
                  await refresh();
                  setBusy("");
                }}
              >
                Check connection
              </Button>
            </Paper>
          );
        })}
      </SimpleGrid>
      {data?.projects.map((p, i) => (
        <Paper withBorder p="lg" key={i}>
          <Title order={3}>{p.displayName}</Title>
          <Text size="sm">
            Installation {p.bmadRuntime?.installStatus ?? "not scanned"} ·
            Version {p.bmadRuntime?.installedVersion ?? "unverified"}
          </Text>
          {p.bmadRuntime?.operations.map((o, j) => (
            <Text key={j} size="sm">
              {o.kind.replaceAll("_", " ")} · {o.status}
              {o.error ? " · " + o.error : ""}
            </Text>
          ))}
        </Paper>
      ))}
      <Button component={Link} href="/connections" variant="subtle">
        Manage connections
      </Button>
    </Stack>
  );
}
