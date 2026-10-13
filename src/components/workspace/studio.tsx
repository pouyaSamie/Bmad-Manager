"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { parse } from "@/lib/toml";
import {
  Title,
  Text,
  Stack,
  Group,
  Button,
  Paper,
  Badge,
  Alert,
  TextInput,
  Select,
  Textarea,
  Modal,
  SimpleGrid,
  Accordion,
  Loader,
  Tabs,
} from "@mantine/core";
import {
  getBmadControl,
  scanBmadControl,
  draftBmadOperation,
  approveBmadOperation,
  getBmadSkillContent,
  discardBmadOperation,
  releaseAbandonedOperation,
} from "@/actions/bmad-control-actions";
import {
  listConnections,
  assignConnection,
} from "@/actions/connection-actions";
import { AgentInspector } from "./agent-inspector";
import { WorkflowEditor } from "./workflow-editor";
import type { Connection } from "./connections";
import type { Agent, StudioData } from "./studio-types";
import { migrateGraph } from "@/lib/workflow-graph";
export function Studio({
  owner,
  name,
  section,
}: {
  owner: string;
  name: string;
  section: "agents" | "workflow" | "settings";
}) {
  const [data, setData] = useState<StudioData | null>(null),
    [connections, setConnections] = useState<Connection[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [agent, setAgent] = useState<Agent | null>(null),
    [search, setSearch] = useState(""),
    [conn, setConn] = useState<string | null>(null),
    [model, setModel] = useState<string | null>(null),
    [createOpen, setCreateOpen] = useState(false),
    [cloneId, setCloneId] = useState<string | null>(null),
    [slug, setSlug] = useState("my-agent"),
    [newName, setName] = useState("Project reviewer"),
    [role, setRole] = useState("Reviewer"),
    [persona, setPersona] = useState(
      "Review the product from the perspective of an end user. Explain specific improvements.",
    ),
    [scope, setScope] = useState("team"),
    [skillDetails, setSkillDetails] = useState<{
      name: string;
      description: string;
      content: string;
      fields: string[];
    } | null>(null);
  const refresh = useCallback(async () => {
    const [r, c] = await Promise.all([
      getBmadControl({ owner, name }),
      listConnections(),
    ]);
    if (r.success) {
      const d = r.data as StudioData;
      setData(d);
      setConn((current) => current ?? d.runtime.connectionId);
      setModel((current) => current ?? d.runtime.modelId);
    } else setError(r.error);
    if (c.success) setConnections(c.data);
    else setError(c.error);
  }, [owner, name]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!data?.operations.some((o) => ["queued", "running"].includes(o.status)))
      return;
    const timer = setInterval(() => void refresh(), 3000);
    return () => clearInterval(timer);
  }, [data?.operations, refresh]);
  if (!data)
    return (
      <Stack>{error ? <Alert color="red">{error}</Alert> : <Loader />}</Stack>
    );
  const projectConnection = connections.find(
    (c) => c.id === data.runtime.connectionId,
  );
  const pending = data.operations.filter((o) =>
    ["draft", "queued", "running"].includes(o.status),
  );
  async function draftNew() {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      let payload: Record<string, unknown> = {
        slug,
        name: newName,
        title: role,
        description: role,
        icon: "🤖",
        persona,
        scope,
        skillName: slug,
      };
      let kind: "create_agent" | "clone_skill" = "create_agent";
      if (cloneId) {
        const r = await getBmadSkillContent({ owner, name, skillId: cloneId });
        if (!r.success) {
          setError(r.error);
          return;
        }
        payload = {
          ...payload,
          content: r.data.content.replace(/^name:.*$/m, "name: " + slug),
          sourceDirectory: r.data.directory,
        };
        kind = "clone_skill";
      }
      const r = await draftBmadOperation({ owner, name, kind, payload });
      if (!r.success) setError(r.error);
      else {
        setCreateOpen(false);
        setNotice("Draft created. Review and approve it in Project Settings.");
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack gap="xl">
      {error && <Alert color="red">{error}</Alert>}
      {notice && <Alert color="green">{notice}</Alert>}
      {section === "workflow" ? (
        <WorkflowEditor
          data={data}
          owner={owner}
          name={name}
          connections={connections}
          onInspect={setAgent}
          onRefresh={refresh}
        />
      ) : section === "agents" ? (
        <>
          <Group justify="space-between">
            <div>
              <Title order={1}>Agents</Title>
              <Text c="dimmed" mt={6}>
                Your team, their instructions, and the models they use.
              </Text>
            </div>
            <Group>
              <Button
                variant="default"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await scanBmadControl({ owner, name });
                  setBusy(false);
                  if (!r.success) setError(r.error);
                  await refresh();
                }}
              >
                Inspect installation
              </Button>
              <Button
                onClick={() => {
                  setCloneId(null);
                  setSlug("my-agent");
                  setCreateOpen(true);
                }}
              >
                Create agent
              </Button>
            </Group>
          </Group>
          <TextInput
            placeholder="Search agents and skills"
            aria-label="Search agents and skills"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Tabs defaultValue="agents">
            <Tabs.List>
              <Tabs.Tab value="agents">Agents · {data.agents.length}</Tabs.Tab>
              <Tabs.Tab value="skills">
                Skill library · {data.skills.length}
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="agents" pt="lg">
              <SimpleGrid cols={{ base: 1, lg: 2, xl: 3 }}>
                {data.agents
                  .filter((a) =>
                    (a.name + " " + a.title)
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((a) => {
                    const c = connections.find(
                      (c) =>
                        c.id === (a.connectionId ?? data.runtime.connectionId),
                    );
                    const official = [
                      "bmad-agent-analyst",
                      "bmad-agent-pm",
                      "bmad-agent-architect",
                      "bmad-agent-dev",
                      "bmad-agent-ux-designer",
                    ].includes(a.skillName ?? "");
                    return (
                      <Paper withBorder p="xl" radius="lg" key={a.id}>
                        <Stack>
                          <Group justify="space-between">
                            <Text fw={650} size="lg">
                              {a.icon} {a.name}
                            </Text>
                            <Badge
                              variant="light"
                              color={
                                !a.available
                                  ? "red"
                                  : official
                                    ? "indigo"
                                    : "gray"
                              }
                            >
                              {!a.available
                                ? "Unavailable"
                                : official
                                  ? "BMad core"
                                  : "Extension"}
                            </Badge>
                          </Group>
                          <Text c="dimmed">{a.title}</Text>
                          <Text size="sm" lineClamp={3}>
                            {a.description ??
                              "Configure the persona and attached skill."}
                          </Text>
                          <Paper bg="var(--muted)" p="md">
                            <Text size="sm" fw={600}>
                              {c?.name ?? "No connection assigned"}
                            </Text>
                            <Text
                              size="xs"
                              c="dimmed"
                              style={{ overflowWrap: "anywhere" }}
                            >
                              {a.connectionId
                                ? a.modelId
                                : (data.runtime.modelId ?? "Choose a model")}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {a.connectionId
                                ? "Agent override"
                                : "Project default"}{" "}
                              · {c?.status ?? "unverified"}
                            </Text>
                          </Paper>
                          <Button variant="light" onClick={() => setAgent(a)}>
                            Configure and test
                          </Button>
                        </Stack>
                      </Paper>
                    );
                  })}
              </SimpleGrid>
              {!data.agents.length && (
                <Alert mt="md">
                  Inspect the installation to discover agents, or create a
                  managed agent.
                </Alert>
              )}
            </Tabs.Panel>
            <Tabs.Panel value="skills" pt="lg">
              <Stack>
                {data.skills
                  .filter((s) =>
                    (s.name + " " + s.description)
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((s) => (
                    <Paper withBorder p="lg" key={s.id}>
                      <Group justify="space-between">
                        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                          <Text fw={600} style={{ overflowWrap: "anywhere" }}>
                            {s.name}
                          </Text>
                          <Text size="sm" c="dimmed" lineClamp={2}>
                            {s.description}
                          </Text>
                          <Badge mt="xs" color={s.isManaged ? "green" : "gray"}>
                            {s.source === "missing"
                              ? "Unavailable"
                              : s.isManaged
                                ? "Managed"
                                : "Installed · protected"}
                          </Badge>
                        </div>
                        <Button
                          variant="subtle"
                          disabled={s.source === "missing"}
                          onClick={async () => {
                            const r = await getBmadSkillContent({
                              owner,
                              name,
                              skillId: s.id,
                            });
                            if (r.success)
                              setSkillDetails({
                                name: s.name,
                                description:
                                  s.description ??
                                  "Read installed instructions for purpose and usage.",
                                content: r.data.content,
                                fields: s.customizeSchema
                                  ? Object.keys(
                                      (parse(s.customizeSchema).agent ??
                                        parse(s.customizeSchema).workflow ??
                                        {}) as object,
                                    )
                                  : [],
                              });
                            else setError(r.error);
                          }}
                        >
                          View capability
                        </Button>
                        <Button
                          variant="light"
                          disabled={s.source === "missing"}
                          onClick={() => {
                            setCloneId(s.id);
                            setSlug("my-" + s.name.replace(/^bmad-/, ""));
                            setCreateOpen(true);
                          }}
                        >
                          Create managed copy
                        </Button>
                      </Group>
                    </Paper>
                  ))}
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </>
      ) : (
        <>
          <div>
            <Title order={1}>Project settings</Title>
            <Text c="dimmed" mt={6}>
              Project defaults, installation, and reviewed changes.
            </Text>
          </div>
          <Paper withBorder p="xl">
            <Stack>
              <Title order={3}>Default connection</Title>
              <Text c="dimmed" size="sm">
                Agents inherit this connection unless they have an override.
              </Text>
              <Group align="end">
                <Select
                  label="Connection"
                  value={conn}
                  data={connections.map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                  onChange={(v) => {
                    setConn(v);
                    setModel(null);
                  }}
                  style={{ flex: "1 1 240px" }}
                  clearable
                />
                <Select
                  label="Model"
                  searchable
                  value={model}
                  data={(
                    connections.find((c) => c.id === conn)?.models ?? []
                  ).map((m) => ({ value: m.id, label: m.name }))}
                  onChange={setModel}
                  style={{ flex: "1 1 240px" }}
                />
                <Button
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    const r = await assignConnection({
                      owner,
                      name,
                      connectionId: conn,
                      modelId: model,
                    });
                    setBusy(false);
                    if (!r.success) setError(r.error);
                    else {
                      setNotice("Project model default saved.");
                      await refresh();
                    }
                  }}
                >
                  Save default
                </Button>
              </Group>
              <Text size="sm" c="dimmed">
                Current: {projectConnection?.name ?? "No connection selected"} ·{" "}
                {data.runtime.modelId ?? "No model"}
              </Text>
              <Button
                component={Link}
                href="/connections"
                variant="subtle"
                style={{ alignSelf: "flex-start" }}
              >
                Manage connections
              </Button>
            </Stack>
          </Paper>
          <Paper withBorder p="xl">
            <Group justify="space-between">
              <div>
                <Title order={3}>BMad installation</Title>
                <Text c="dimmed" size="sm">
                  {data.installation.generation} ·{" "}
                  {data.installation.version ?? "Version not detected"} ·{" "}
                  {data.installation.method}
                </Text>
              </div>
              <Group>
                <Button
                  variant="default"
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    const r = await scanBmadControl({ owner, name });
                    if (!r.success) setError(r.error);
                    await refresh();
                    setBusy(false);
                  }}
                >
                  Inspect installation
                </Button>
                <Button
                  variant="light"
                  disabled={!data.installation.canUpdate}
                  onClick={async () => {
                    const r = await draftBmadOperation({
                      owner,
                      name,
                      kind: "update",
                      payload: {},
                    });
                    if (!r.success) setError(r.error);
                    await refresh();
                  }}
                >
                  Draft update
                </Button>
              </Group>
            </Group>
          </Paper>
          <Alert color={data.workerOnline ? "green" : "orange"}>
            {data.workerOnline
              ? "Worker connected. Approved changes will be processed."
              : "Worker offline. Start pnpm bmad:worker on the host to apply approved changes."}
          </Alert>
          <Text size="sm">
            {Object.entries(data.installation.moduleVersions ?? {})
              .map(([m, v]) => m + " " + v)
              .join(" · ")}{" "}
            {data.installation.reason}{" "}
            <a
              href="https://docs.bmad-method.org/start/install-bmad/"
              target="_blank"
              rel="noreferrer"
            >
              Official setup guide
            </a>
          </Text>
          <Group justify="space-between">
            <Title order={3}>Review changes · {pending.length} pending</Title>
            <Button variant="subtle" onClick={refresh}>
              Refresh status
            </Button>
          </Group>
          {data.operations.map((o) => {
            const p = (o.preview ?? {}) as {
              summary?: string;
              file?: string;
              files?: string[];
              writes?: string[];
              version?: number;
              fileChanges?: {
                path: string;
                before: string | null;
                after: string | null;
                beforeHash: string | null;
                afterKnown?: boolean;
              }[];
            };
            const payload = (o.payload ?? {}) as Record<string, unknown>;
            const a = data.agents.find((a) => a.slug === payload.slug);
            let summary = p.summary ?? o.kind.replaceAll("_", " ");
            if (o.kind === "customize_agent")
              summary =
                "Customize " + (a?.name ?? String(payload.name ?? "agent"));
            const graph =
              o.kind === "set_workflow"
                ? migrateGraph(payload.graph ?? payload, data.agents)
                : null;
            return (
              <Paper withBorder p="xl" key={o.id}>
                <Stack>
                  <Group justify="space-between">
                    <div>
                      <Text fw={650}>{summary}</Text>
                      <Text size="xs" c="dimmed">
                        {new Date(o.createdAt).toLocaleString()}
                      </Text>
                    </div>
                    <Badge
                      color={
                        o.status === "succeeded"
                          ? "green"
                          : o.status === "failed"
                            ? "red"
                            : o.status === "draft"
                              ? "orange"
                              : "indigo"
                      }
                    >
                      {o.status === "succeeded" ? "Applied" : o.status}
                    </Badge>
                  </Group>
                  {graph && (
                    <>
                      <Text size="sm">
                        Agents:{" "}
                        {graph.nodes
                          .map(
                            (n) =>
                              data.agents.find((a) => a.slug === n.agentSlug)
                                ?.name ??
                              "Unavailable agent (legacy reference)",
                          )
                          .join(" → ")}
                      </Text>
                      <Text size="sm">
                        {graph.edges.filter((e) => e.kind === "forward").length}{" "}
                        handoffs ·{" "}
                        {
                          graph.edges.filter((e) => e.kind === "feedback")
                            .length
                        }{" "}
                        feedback loops
                      </Text>
                      {graph.edges
                        .filter((e) => e.kind === "feedback")
                        .map((e) => (
                          <Text size="sm" key={e.id}>
                            {
                              data.agents.find(
                                (a) =>
                                  a.slug ===
                                  graph.nodes.find((n) => n.id === e.source)
                                    ?.agentSlug,
                              )?.name
                            }{" "}
                            →{" "}
                            {
                              data.agents.find(
                                (a) =>
                                  a.slug ===
                                  graph.nodes.find((n) => n.id === e.target)
                                    ?.agentSlug,
                              )?.name
                            }
                            : {e.trigger}, {e.maxIterations} iterations
                          </Text>
                        ))}
                    </>
                  )}
                  {p.fileChanges?.length ? (
                    <Accordion>
                      {p.fileChanges.map((c) => (
                        <Accordion.Item key={c.path} value={c.path}>
                          <Accordion.Control>{c.path}</Accordion.Control>
                          <Accordion.Panel>
                            <SimpleGrid cols={{ base: 1, md: 2 }}>
                              <div>
                                <Text fw={600}>Before</Text>
                                <pre
                                  style={{
                                    overflow: "auto",
                                    fontSize: 14,
                                    maxHeight: 320,
                                  }}
                                >
                                  {c.before ?? "File does not exist"}
                                </pre>
                              </div>
                              <div>
                                <Text fw={600}>
                                  {c.afterKnown === false
                                    ? "Expected action"
                                    : "After"}
                                </Text>
                                <pre
                                  style={{
                                    overflow: "auto",
                                    fontSize: 14,
                                    maxHeight: 320,
                                  }}
                                >
                                  {c.afterKnown === false
                                    ? "Installer-controlled file. Detected settings are preserved; the result is inspected after installation."
                                    : (c.after ??
                                      "Override removed; inherited settings apply")}
                                </pre>
                              </div>
                            </SimpleGrid>
                            <Text size="xs" c="dimmed">
                              Changes after this review require a new draft.
                            </Text>
                          </Accordion.Panel>
                        </Accordion.Item>
                      ))}
                    </Accordion>
                  ) : null}
                  {p.writes && (
                    <Text size="sm">Changes: {p.writes.join(", ")}</Text>
                  )}
                  {(p.file || p.files) && (
                    <Text
                      size="sm"
                      c="dimmed"
                      style={{ overflowWrap: "anywhere" }}
                    >
                      Files: {p.file ?? p.files?.join(", ")}
                    </Text>
                  )}
                  {o.status === "draft" &&
                    o.kind === "set_workflow" &&
                    !payload.graph && (
                      <Alert color="orange">
                        This draft uses an older workflow format. Create a new
                        graph draft before approving.
                      </Alert>
                    )}
                  {o.status === "failed" &&
                    o.error?.includes("heartbeat expired") && (
                      <Button
                        color="orange"
                        variant="light"
                        onClick={async () => {
                          if (
                            !window.confirm(
                              "Confirm you have stopped the previous worker and checked partial files. Release this project lock?",
                            )
                          )
                            return;
                          const r = await releaseAbandonedOperation({
                            owner,
                            name,
                            operationId: o.id,
                            confirmedStopped: true,
                          });
                          if (!r.success) setError(r.error);
                          else
                            setNotice(
                              "Project lock released. Create and review a fresh draft before retrying.",
                            );
                          await refresh();
                        }}
                      >
                        Release abandoned project lock
                      </Button>
                    )}
                  {o.status === "draft" && p.version !== 2 && (
                    <Alert color="orange">
                      Legacy draft: create a fresh draft to review actual file
                      changes. Existing files have not been changed.
                    </Alert>
                  )}
                  {o.status === "draft" && (
                    <Group>
                      <Text size="sm" c="dimmed">
                        Approval queues this change for the separate worker.
                      </Text>
                      <Button
                        loading={busy}
                        disabled={
                          p.version !== 2 ||
                          (o.kind === "set_workflow" && !payload.graph)
                        }
                        onClick={async () => {
                          setBusy(true);
                          const r = await approveBmadOperation({
                            owner,
                            name,
                            operationId: o.id,
                          });
                          setBusy(false);
                          if (!r.success) setError(r.error);
                          else
                            setNotice(
                              "Queued for the worker. Awaiting application.",
                            );
                          await refresh();
                        }}
                      >
                        Approve change
                      </Button>
                      <Button
                        variant="subtle"
                        color="red"
                        onClick={async () => {
                          const r = await discardBmadOperation({
                            owner,
                            name,
                            operationId: o.id,
                          });
                          if (!r.success) setError(r.error);
                          await refresh();
                        }}
                      >
                        Discard draft
                      </Button>
                    </Group>
                  )}
                </Stack>
              </Paper>
            );
          })}
          {!data.operations.length && (
            <Text c="dimmed">No changes waiting for review.</Text>
          )}
        </>
      )}
      {agent && (
        <AgentInspector
          key={agent.id}
          agent={agent}
          data={data}
          connections={connections}
          owner={owner}
          name={name}
          onClose={() => setAgent(null)}
          onRefresh={refresh}
        />
      )}
      <Modal
        opened={!!skillDetails}
        onClose={() => setSkillDetails(null)}
        title={skillDetails?.name}
        size="lg"
      >
        <Stack>
          <Text fw={600}>Purpose</Text>
          <Text>{skillDetails?.description}</Text>
          <Text fw={600}>Supported customization fields</Text>
          <Text size="sm">
            {skillDetails?.fields.join(", ") ||
              "No installed customization schema. Create a managed copy to customize this capability."}
          </Text>
          <Text fw={600}>Inputs, outputs, and installed instructions</Text>
          <Text size="sm" c="dimmed">
            The installed skill defines its own prerequisites and outputs.
            Reading these instructions does not execute the skill.
          </Text>
          <pre
            style={{
              overflow: "auto",
              maxHeight: 500,
              fontSize: 14,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {skillDetails?.content}
          </pre>
        </Stack>
      </Modal>
      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title={cloneId ? "Create managed skill copy" : "Create managed agent"}
      >
        <Stack>
          <TextInput
            label="Unique slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          {!cloneId && (
            <>
              <TextInput
                label="Name"
                value={newName}
                onChange={(e) => setName(e.target.value)}
              />
              <TextInput
                label="Role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
              <Textarea
                label="Persona"
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                minRows={5}
              />
              <Select
                label="Scope"
                value={scope}
                onChange={(v) => setScope(v ?? "team")}
                data={["team", "personal"]}
              />
            </>
          )}
          <Alert>
            Creates a draft for review. Installed vendor assets stay protected.
          </Alert>
          <Button onClick={draftNew} loading={busy}>
            Create draft
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
