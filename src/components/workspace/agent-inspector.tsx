"use client";
import { BehaviorEditor } from "./behavior-editor";
import {
  previewBehavior,
  behaviorPrompt,
  type AgentBehavior,
} from "@/lib/agent-behavior";
import { useUnsavedChanges } from "./use-unsaved-changes";

import { useRef, useState } from "react";
import { useMediaQuery } from "@mantine/hooks";
import {
  Drawer,
  Tabs,
  Stack,
  Text,
  Select,
  Textarea,
  TextInput,
  Button,
  Alert,
  Group,
  Paper,
  Badge,
  ScrollArea,
} from "@mantine/core";
import { assignConnection } from "@/actions/connection-actions";
import {
  draftBmadOperation,
  getConversationMessages,
} from "@/actions/bmad-control-actions";
import { sseData } from "@/lib/model-stream";
import type { Agent, StudioData } from "./studio-types";
import type { Connection } from "./connections";
export function AgentInspector({
  agent,
  data,
  connections,
  owner,
  name,
  onClose,
  onRefresh,
}: {
  agent: Agent;
  data: StudioData;
  connections: Connection[];
  owner: string;
  name: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const mobile = useMediaQuery("(max-width:48em)");
  const [tab, setTab] = useState<string | null>("model"),
    [connectionId, setConnection] = useState(agent.connectionId ?? "project"),
    [model, setModel] = useState(agent.modelId ?? ""),
    [patch, setPatch] = useState<AgentBehavior>({}),
    [reset, setReset] = useState<string[]>([]),
    [historyCursor, setHistoryCursor] = useState<string | null>(null),
    [skill, setSkill] = useState(agent.skillName ?? ""),
    [displayName, setName] = useState(agent.name),
    [title, setTitle] = useState(agent.title),
    [scope, setScope] = useState(agent.scope),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState("Hello. Briefly introduce your role."),
    [conversation, setConversation] = useState<string | null>(null),
    [lines, setLines] = useState<
      { role: string; content: string; status?: string }[]
    >([]),
    [metadata, setMetadata] = useState("");
  const abort = useRef<AbortController | null>(null);
  const effectiveId =
    connectionId === "project" ? data.runtime.connectionId : connectionId;
  const connection = connections.find((c) => c.id === effectiveId);
  const effectiveModel =
    connectionId === "project" ? data.runtime.modelId : model;
  const models = connection?.models ?? [];
  const [savedRoute, setSavedRoute] = useState({
    connectionId: agent.connectionId ?? "project",
    modelId: agent.modelId ?? "",
  });
  const [draftedSignature, setDraftedSignature] = useState(
    JSON.stringify({
      displayName: agent.name,
      title: agent.title,
      skill: agent.skillName ?? "",
      scope: agent.scope,
      patch: {},
      reset: [],
    }),
  );
  const currentSignature = JSON.stringify({
    displayName,
    title,
    skill,
    scope,
    patch,
    reset,
  });
  const routeEdited =
    connectionId !== savedRoute.connectionId ||
    (connectionId !== "project" && model !== savedRoute.modelId);
  const customization = agent.customization;
  const preview = previewBehavior(customization, scope, patch, reset);
  const customizationEdited = currentSignature !== draftedSignature;
  useUnsavedChanges(routeEdited || customizationEdited);
  const pending = data.operations.some(
    (o) =>
      o.status === "draft" && JSON.stringify(o.payload).includes(agent.slug),
  );
  async function saveRoute() {
    setBusy(true);
    setError("");
    try {
      const r = await assignConnection({
        owner,
        name,
        agentId: agent.id,
        connectionId: connectionId === "project" ? null : connectionId,
        modelId: connectionId === "project" ? null : model,
      });
      if (!r.success) setError(r.error);
      else {
        setSavedRoute({ connectionId, modelId: model });
        setNotice("Model assignment saved. Repository files were not changed.");
        await onRefresh();
      }
    } finally {
      setBusy(false);
    }
  }
  async function draft() {
    setBusy(true);
    setError("");
    try {
      const r = await draftBmadOperation({
        owner,
        name,
        kind: "customize_agent",
        payload: {
          agentId: agent.id,
          slug: agent.slug,
          skillName: skill,
          descriptor: {
            ...(displayName !== agent.name ? { name: displayName } : {}),
            ...(title !== agent.title ? { title } : {}),
            ...(skill !== agent.skillName ? { skill } : {}),
          },
          behaviorPatch: patch,
          behaviorReset: reset,
          scope,
        },
      });
      if (!r.success) setError(r.error);
      else {
        setNotice(
          "Customization drafted. Review and approve it in Project Settings.",
        );
        setDraftedSignature(currentSignature);
        await onRefresh();
      }
    } finally {
      setBusy(false);
    }
  }
  async function send(retryPrompt?: string) {
    if (!connection || !effectiveModel || !(retryPrompt ?? message).trim())
      return;
    setBusy(true);
    setError("");
    setMetadata("");
    const prompt = retryPrompt ?? message;
    setLines((l) => [
      ...l,
      { role: "user", content: prompt },
      { role: "assistant", content: "" },
    ]);
    setMessage("");
    abort.current = new AbortController();
    let answer = "";
    let terminal = "failed";
    try {
      const res = await fetch("/api/bmad/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: abort.current.signal,
        body: JSON.stringify({
          owner,
          name,
          agentId: agent.id,
          conversationId: conversation ?? undefined,
          message: prompt,
          preview: {
            connectionId: connection.id,
            modelId: effectiveModel,
            persona: behaviorPrompt(preview),
            skillName: skill,
          },
        }),
      });
      if (!res.ok) {
        const r = await res.json();
        throw new Error(r.error ?? "Unable to start conversation");
      }
      if (!res.body) throw new Error("No response stream");
      for await (const raw of sseData(res.body)) {
        const e = JSON.parse(raw);
        if (e.type === "metadata") {
          setConversation(e.conversationId);
          setMetadata(e.provider + " · " + e.model + " · preview");
        }
        if (e.type === "text") {
          answer += e.text;
          setLines((l) => [
            ...l.slice(0, -1),
            { role: "assistant", content: answer },
          ]);
        }
        if (e.type === "error") {
          terminal = "failed";
          setError(e.error);
        }
        if (e.type === "completion") {
          terminal = "completed";
          setMetadata((m) => m + " · " + (e.latencyMs / 1000).toFixed(1) + "s");
        }
      }
    } catch (e) {
      terminal = abort.current?.signal.aborted ? "cancelled" : "failed";
      setError(
        abort.current?.signal.aborted
          ? "Conversation stopped. Partial output is retained."
          : e instanceof Error
            ? e.message
            : "Conversation failed",
      );
    } finally {
      setLines((l) =>
        l.map((line, i) =>
          i === l.length - 1 ? { ...line, status: terminal } : line,
        ),
      );
      setBusy(false);
      abort.current = null;
      await onRefresh();
    }
  }
  return (
    <Drawer
      opened
      onClose={() => {
        if (
          (routeEdited || customizationEdited) &&
          !window.confirm("Discard unsaved edits and close this inspector?")
        )
          return;
        abort.current?.abort();
        onClose();
      }}
      title={agent.icon + " " + agent.name}
      position="right"
      size={mobile ? "100%" : 600}
    >
      <Stack>
        <Text c="dimmed">{agent.title}</Text>
        {routeEdited && <Badge color="orange">Unsaved model preview</Badge>}
        {pending && (
          <Badge color="orange">Customization awaiting approval</Badge>
        )}
        {notice && <Alert color="green">{notice}</Alert>}
        {error && <Alert color="red">{error}</Alert>}
        <Tabs value={tab} onChange={setTab}>
          <Tabs.List>
            <Tabs.Tab value="model">Model</Tabs.Tab>
            <Tabs.Tab value="persona">Persona</Tabs.Tab>
            <Tabs.Tab value="skills">Skills</Tabs.Tab>
            <Tabs.Tab value="chat">Test chat</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="model" pt="lg">
            <Stack>
              <Select
                label="Connection"
                value={connectionId}
                data={[
                  { value: "project", label: "Inherit project default" },
                  ...connections.map((c) => ({ value: c.id, label: c.name })),
                ]}
                onChange={(v) => {
                  setConnection(v ?? "project");
                  setModel("");
                }}
              />
              {connectionId !== "project" && (
                <Select
                  label="Model"
                  searchable
                  data={models.map((m) => ({ value: m.id, label: m.name }))}
                  value={model || null}
                  onChange={(v) => setModel(v ?? "")}
                  placeholder="Choose a discovered model"
                />
              )}
              <Paper withBorder p="md">
                <Text size="sm" fw={600}>
                  Effective assignment
                </Text>
                <Text size="sm" mt="xs">
                  {connection?.name ?? "No connection selected"}
                </Text>
                <Text size="sm" style={{ overflowWrap: "anywhere" }}>
                  {effectiveModel ?? "No model selected"}
                </Text>
                <Badge
                  mt="sm"
                  color={connection?.status === "tested" ? "green" : "gray"}
                >
                  {connection?.status ?? "unverified"}
                </Badge>
              </Paper>
              {!models.length && (
                <Alert color="orange">
                  Discover models in Connections before assigning one.
                </Alert>
              )}
              <Button
                variant="subtle"
                onClick={() => {
                  setConnection("project");
                  setModel("");
                }}
              >
                Use project default
              </Button>
              <Button
                loading={busy}
                disabled={connectionId !== "project" && !model}
                onClick={saveRoute}
              >
                Save model assignment
              </Button>
              <Button variant="light" onClick={() => setTab("chat")}>
                Test this configuration
              </Button>
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="persona" pt="lg">
            <Stack>
              <TextInput
                label="Display name (Manager roster)"
                value={displayName}
                onChange={(e) => setName(e.target.value)}
              />
              <TextInput
                label="Title (Manager roster)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {customization.legacy?.identity && (
                <Alert color="orange">
                  Legacy Manager instructions are included in this preview. To
                  apply them through BMad’s supported customization surface,
                  draft a conversion below.
                  <Button
                    mt="sm"
                    variant="light"
                    onClick={() =>
                      setPatch((p) => ({
                        ...p,
                        identity: customization.legacy!.identity,
                      }))
                    }
                  >
                    Preview legacy persona conversion
                  </Button>
                </Alert>
              )}
              <BehaviorEditor
                state={customization}
                skills={data.skills.filter((s) => s.source !== "missing")}
                scope={scope}
                patch={patch}
                reset={reset}
                onChange={(key, value) => {
                  setPatch((p) => ({ ...p, [key]: value }));
                  setReset((r) => r.filter((k) => k !== key));
                }}
                onReset={(key) => {
                  setPatch((p) => {
                    const next = { ...p };
                    delete next[key as keyof AgentBehavior];
                    return next;
                  });
                  setReset((r) => [...new Set([...r, key])]);
                }}
              />
              <Select
                label="Customization scope"
                value={scope}
                data={[
                  { value: "team", label: "Team · committed override" },
                  {
                    value: "personal",
                    label: "Personal · gitignored override",
                  },
                ]}
                onChange={(v) => {
                  setScope(v ?? "team");
                  setPatch({});
                  setReset([]);
                }}
              />
              <Text size="sm" c="dimmed">
                Preview these instructions in Test chat. Applying them creates a
                reviewed per-skill override.
              </Text>
              <Button loading={busy} onClick={draft}>
                Draft customization
              </Button>
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="skills" pt="lg">
            <Stack>
              <Select
                label="Attached skill"
                searchable
                value={skill}
                data={data.skills
                  .filter((s) => s.source !== "missing")
                  .map((s) => ({
                    value: s.name,
                    label:
                      s.name + (s.isManaged ? " · managed" : " · installed"),
                  }))}
                onChange={(v) => setSkill(v ?? "")}
              />
              <Text size="sm" c="dimmed">
                Installed skills are protected. Change behavior with an
                override, or create a managed copy from the skill library.
              </Text>
              <Button loading={busy} onClick={draft}>
                Draft skill assignment
              </Button>
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="chat" pt="lg">
            <Stack>
              <Alert color="indigo">
                Configuration preview only. Workflows, file changes, and tools
                are disabled.
              </Alert>
              <Select
                label="Previous conversations"
                clearable
                placeholder="New conversation"
                value={conversation}
                data={data.conversations
                  .filter((c) => c.agentId === agent.id)
                  .map((c) => ({ value: c.id, label: c.title }))}
                onChange={async (v) => {
                  setConversation(v);
                  setLines([]);
                  setMetadata("");
                  setHistoryCursor(null);
                  if (v) {
                    const r = await getConversationMessages({
                      owner,
                      name,
                      agentId: agent.id,
                      conversationId: v,
                    });
                    if (r.success) {
                      setLines(r.data.messages);
                      setHistoryCursor(r.data.nextBefore);
                    } else setError(r.error);
                  }
                }}
              />
              <Text size="xs" c="dimmed" style={{ overflowWrap: "anywhere" }}>
                {metadata ||
                  [connection?.name, effectiveModel]
                    .filter(Boolean)
                    .join(" · ")}
              </Text>
              {historyCursor && (
                <Button
                  variant="subtle"
                  onClick={async () => {
                    if (!conversation) return;
                    const r = await getConversationMessages({
                      owner,
                      name,
                      agentId: agent.id,
                      conversationId: conversation,
                      before: historyCursor,
                    });
                    if (r.success) {
                      setLines((l) => [...r.data.messages, ...l]);
                      setHistoryCursor(r.data.nextBefore);
                    } else setError(r.error);
                  }}
                >
                  Load earlier messages
                </Button>
              )}
              <ScrollArea h={320}>
                <Stack>
                  {lines.map((l, i) => (
                    <Paper key={i} p="md" withBorder>
                      <Text fw={600} size="xs" c="dimmed">
                        {l.role === "user" ? "YOU" : agent.name.toUpperCase()}
                      </Text>
                      <Text
                        size="sm"
                        mt="xs"
                        style={{
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {l.content ||
                          (l.status && l.status !== "streaming"
                            ? "No response was received."
                            : "Waiting for response…")}
                      </Text>
                      {l.status && l.status !== "completed" && (
                        <Badge
                          mt="sm"
                          color={l.status === "failed" ? "red" : "gray"}
                        >
                          {l.status}
                        </Badge>
                      )}
                    </Paper>
                  ))}
                </Stack>
              </ScrollArea>
              <Textarea
                label="Message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                minRows={3}
              />
              <Group>
                <Button
                  onClick={() => void send()}
                  loading={busy}
                  disabled={!connection || !effectiveModel || !agent.available}
                >
                  Send test message
                </Button>
                {!busy &&
                  lines.at(-1)?.status &&
                  lines.at(-1)?.status !== "completed" && (
                    <Button
                      variant="light"
                      onClick={() => {
                        const prompt = [...lines]
                          .reverse()
                          .find((l) => l.role === "user")?.content;
                        if (prompt) void send(prompt);
                      }}
                    >
                      Retry last message
                    </Button>
                  )}
                {busy && (
                  <Button
                    variant="light"
                    onClick={() => abort.current?.abort()}
                  >
                    Stop
                  </Button>
                )}
                <Button
                  variant="subtle"
                  onClick={() => {
                    setConversation(null);
                    setLines([]);
                  }}
                >
                  New conversation
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Drawer>
  );
}
