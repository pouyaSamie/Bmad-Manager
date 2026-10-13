"use client";
import { useEffect, useState } from "react";
import {
  Title,
  Text,
  Stack,
  Group,
  Button,
  Paper,
  Badge,
  Modal,
  TextInput,
  PasswordInput,
  Select,
  Alert,
  SimpleGrid,
  Accordion,
} from "@mantine/core";
import Link from "next/link";
import type { ConnectionEvidence } from "@/lib/model-adapters";
import { Plus, RefreshCw, Plug } from "lucide-react";
import {
  listConnections,
  saveConnection,
  checkConnection,
  deleteConnection,
} from "@/actions/connection-actions";
import { providers, type ModelOption } from "@/lib/providers";
export type Connection = {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  hasKey: boolean;
  status: string;
  models: ModelOption[] | null;
  checkedAt: Date | null;
  evidence?: unknown;
};
export function Connections() {
  const [rows, setRows] = useState<Connection[]>([]),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [form, setForm] = useState({
      id: undefined as string | undefined,
      name: "Ollama",
      provider: "ollama",
      baseUrl: providers[0].baseUrl,
      apiKey: "",
    });
  async function load() {
    const r = await listConnections();
    if (r.success) setRows(r.data);
    else setError(r.error);
  }
  useEffect(() => {
    void listConnections().then((r) => {
      if (r.success) setRows(r.data);
      else setError(r.error);
    });
  }, []);
  async function check(id: string) {
    setBusy(id);
    setError("");
    try {
      const r = await checkConnection({ id });
      if (!r.success) setError(r.error);
      await load();
    } finally {
      setBusy("");
    }
  }
  const preset = providers.find((p) => p.id === form.provider);
  return (
    <Stack gap="xl">
      <Button
        component={Link}
        href="/diagnostics"
        variant="subtle"
        style={{ alignSelf: "flex-end" }}
      >
        Connection and worker diagnostics
      </Button>
      <Group justify="space-between">
        <div>
          <Title order={1}>Connections</Title>
          <Text c="dimmed" mt={6}>
            Connect once. Choose a different model for every agent.
          </Text>
        </div>
        <Button
          leftSection={<Plus size={18} />}
          onClick={() => {
            setForm({
              id: undefined,
              name: "Ollama",
              provider: "ollama",
              baseUrl: providers[0].baseUrl,
              apiKey: "",
            });
            setOpen(true);
          }}
        >
          Add connection
        </Button>
      </Group>
      {error && (
        <Alert color="red" title="Connection needs attention">
          {error}
        </Alert>
      )}
      <Alert icon={<Plug size={18} />} color="indigo">
        Reachable means the model catalog responded. Tested means a real
        conversation completed successfully. CLI connections use your host
        bridge and its access token.
      </Alert>
      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
        {rows.map((c) => (
          <Paper key={c.id} withBorder p="xl" radius="lg">
            <Stack>
              <Group justify="space-between">
                <Text fw={650} size="lg">
                  {c.name}
                </Text>
                <Badge
                  color={
                    c.status === "tested"
                      ? "green"
                      : c.status === "unavailable"
                        ? "red"
                        : "gray"
                  }
                >
                  {c.status}
                </Badge>
              </Group>
              <Text c="dimmed">
                {providers.find((p) => p.id === c.provider)?.name ?? c.provider}
              </Text>
              <Text size="sm">{c.models?.length ?? 0} discovered models</Text>
              {c.checkedAt &&
                Date.now() - new Date(c.checkedAt).getTime() > 86400000 && (
                  <Badge color="orange">Catalog stale · discover again</Badge>
                )}
              <Text size="xs" c="dimmed">
                {c.checkedAt
                  ? "Last checked " + new Date(c.checkedAt).toLocaleString()
                  : "Not checked yet"}
              </Text>
              <Text size="xs" c="dimmed">
                Catalog:{" "}
                {(c.evidence as ConnectionEvidence)?.catalog?.status ??
                  "unverified"}{" "}
                · Authentication:{" "}
                {(c.evidence as ConnectionEvidence)?.authentication?.status ??
                  "unverified"}
              </Text>
              <Accordion>
                <Accordion.Item value="tests">
                  <Accordion.Control>Model test results</Accordion.Control>
                  <Accordion.Panel>
                    {Object.entries(
                      (c.evidence as ConnectionEvidence)?.tests ?? {},
                    ).map(([model, test]) => (
                      <Text
                        key={model}
                        size="sm"
                        style={{ overflowWrap: "anywhere" }}
                      >
                        {model} · {test.status} ·{" "}
                        {new Date(test.checkedAt).toLocaleString()}
                        {test.latencyMs
                          ? " · " + (test.latencyMs / 1000).toFixed(1) + "s"
                          : ""}
                      </Text>
                    ))}
                    {!Object.keys(
                      (c.evidence as ConnectionEvidence)?.tests ?? {},
                    ).length && (
                      <Text size="sm" c="dimmed">
                        No model tests recorded. Test an agent using this
                        connection.
                      </Text>
                    )}
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
              <Group>
                <Button
                  variant="light"
                  size="sm"
                  loading={busy === c.id}
                  leftSection={<RefreshCw size={16} />}
                  onClick={() => check(c.id)}
                >
                  Discover models
                </Button>
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => {
                    setForm({
                      id: c.id,
                      name: c.name,
                      provider: c.provider,
                      baseUrl: c.baseUrl,
                      apiKey: "",
                    });
                    setOpen(true);
                  }}
                >
                  Edit
                </Button>
              </Group>
              <Accordion>
                <Accordion.Item value="details">
                  <Accordion.Control>Details</Accordion.Control>
                  <Accordion.Panel>
                    <Text size="xs" style={{ overflowWrap: "anywhere" }}>
                      {c.baseUrl}
                    </Text>
                    <Text size="xs" c="dimmed" mt="xs">
                      {c.hasKey
                        ? "Credential stored securely"
                        : "No stored credential"}
                    </Text>
                    <Button
                      color="red"
                      variant="subtle"
                      size="sm"
                      mt="sm"
                      onClick={async () => {
                        const r = await deleteConnection({ id: c.id });
                        if (!r.success) setError(r.error);
                        await load();
                      }}
                    >
                      Remove unused connection
                    </Button>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>
      {!rows.length && (
        <Paper withBorder p="xl">
          <Title order={3}>Your first connection</Title>
          <Text c="dimmed" mt="sm">
            Add a local server, API provider, or a CLI bridge to begin assigning
            models.
          </Text>
        </Paper>
      )}
      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title={form.id ? "Edit connection" : "Add connection"}
      >
        <Stack>
          <Select
            label="Provider"
            data={providers.map((p) => ({ value: p.id, label: p.name }))}
            value={form.provider}
            onChange={(v) => {
              const p = providers.find((p) => p.id === v);
              if (p)
                setForm({
                  ...form,
                  provider: p.id,
                  name: p.name,
                  baseUrl: p.baseUrl,
                });
            }}
          />
          <TextInput
            label="Connection name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextInput
            label="Endpoint"
            value={form.baseUrl}
            onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
          />
          <PasswordInput
            label={
              form.provider === "codex-cli" || form.provider === "agy"
                ? "Bridge access token"
                : "API key"
            }
            description={
              form.id
                ? "Leave blank to keep the existing credential. Changing provider or endpoint clears it."
                : preset?.key
                  ? "Required by this connection"
                  : "Optional for this local server"
            }
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
          />
          {(form.provider === "codex-cli" || form.provider === "agy") && (
            <Text size="sm" c="dimmed">
              Start the authenticated bridge on your host. Login and tool
              restrictions are verified there; the web app does not launch the
              CLI.
            </Text>
          )}
          <Button
            loading={busy === "save"}
            onClick={async () => {
              setBusy("save");
              const r = await saveConnection({
                ...form,
                provider: form.provider as
                  | "ollama"
                  | "lm-studio"
                  | "openrouter"
                  | "codex-cli"
                  | "agy"
                  | "openai"
                  | "gemini"
                  | "custom",
              });
              setBusy("");
              if (!r.success) {
                setError(r.error);
                return;
              }
              setOpen(false);
              await check(r.data.id);
            }}
          >
            Save and discover models
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
