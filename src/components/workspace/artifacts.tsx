"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Stack,
  Group,
  Title,
  Text,
  Button,
  TextInput,
  Select,
  Paper,
  SimpleGrid,
  Badge,
  Drawer,
  Checkbox,
  SegmentedControl,
  ScrollArea,
  Alert,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { fetchParsedFileContent } from "@/actions/repo-actions";
import { MarkdownRenderer } from "@/components/docs/markdown-renderer";
import type {
  StoryDetail,
  Epic,
  FileTreeNode,
  ParsedBmadFile,
} from "@/lib/bmad/types";
export function StoryBrowser({
  stories,
  epics,
  initialEpic,
  initialView,
}: {
  stories: StoryDetail[];
  epics: Epic[];
  initialEpic?: string;
  initialView?: "table" | "kanban";
}) {
  const [search, setSearch] = useState(""),
    [epic, setEpic] = useState<string | null>(
      initialEpic && initialEpic !== "all" ? initialEpic : null,
    ),
    [status, setStatus] = useState<string | null>(null),
    [view, setView] = useState(initialView === "kanban" ? "board" : "list"),
    [selected, setSelected] = useState<StoryDetail | null>(null);
  const mobile = useMediaQuery("(max-width:48em)");
  const filtered = stories.filter(
    (s) =>
      (!epic || s.epicId === epic) &&
      (!status || s.status === status) &&
      (s.title + " " + s.description)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const statuses = [...new Set(stories.map((s) => s.status))];
  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={1}>Stories</Title>
          <Text c="dimmed">
            {filtered.length} visible of {stories.length} stories
          </Text>
        </div>
        <SegmentedControl
          value={view}
          onChange={setView}
          data={["list", "board"]}
        />
      </Group>
      <Group align="end">
        <TextInput
          label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: "1 1 240px" }}
        />
        <Select
          label="Epic"
          clearable
          searchable
          value={epic}
          onChange={setEpic}
          data={epics.map((e) => ({ value: e.id, label: e.title }))}
          style={{ flex: "1 1 200px" }}
        />
        <Select
          label="Status"
          clearable
          value={status}
          onChange={setStatus}
          data={statuses}
          style={{ flex: "1 1 180px" }}
        />
        <Button
          variant="subtle"
          onClick={() => {
            setSearch("");
            setEpic(null);
            setStatus(null);
          }}
        >
          Clear filters
        </Button>
      </Group>
      {view === "list" ? (
        <Stack gap="xs">
          {filtered.map((s) => (
            <Paper key={s.id} withBorder p="lg">
              <Group justify="space-between">
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <Text fw={600}>{s.title}</Text>
                  <Text c="dimmed" size="sm" mt="xs">
                    {s.epicTitle ?? s.epicId} · {s.completedTasks}/
                    {s.totalTasks} tasks
                  </Text>
                </div>
                <Group>
                  <Badge color={s.status === "done" ? "green" : "gray"}>
                    {s.status}
                  </Badge>
                  <Button variant="light" onClick={() => setSelected(s)}>
                    View story
                  </Button>
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      ) : (
        <ScrollArea>
          <Group align="start" wrap="nowrap">
            {statuses
              .filter((status) => filtered.some((s) => s.status === status))
              .map((status) => (
                <Stack key={status} w={280} style={{ flexShrink: 0 }}>
                  <Text fw={600}>
                    {status} ·{" "}
                    {filtered.filter((s) => s.status === status).length}
                  </Text>
                  {filtered
                    .filter((s) => s.status === status)
                    .map((s) => (
                      <Paper withBorder p="md" key={s.id}>
                        <Text fw={600}>{s.title}</Text>
                        <Button
                          size="sm"
                          variant="light"
                          mt="md"
                          onClick={() => setSelected(s)}
                        >
                          View story
                        </Button>
                      </Paper>
                    ))}
                </Stack>
              ))}
          </Group>
        </ScrollArea>
      )}
      {!filtered.length && <Alert>No stories match these filters.</Alert>}
      <Drawer
        opened={!!selected}
        onClose={() => setSelected(null)}
        title="Story details"
        position="right"
        size={mobile ? "100%" : 650}
      >
        {selected && (
          <Stack>
            <Title order={3}>{selected.title}</Title>
            <Badge>{selected.status}</Badge>
            <MarkdownRenderer content={selected.description} />
            <Title order={4}>Acceptance criteria</Title>
            {selected.acceptanceCriteria.map((c, i) => (
              <MarkdownRenderer key={i} content={c} />
            ))}
            <Title order={4}>Tasks</Title>
            {selected.tasks.map((t, i) => (
              <Checkbox
                key={i}
                checked={t.completed}
                readOnly
                label={t.description}
              />
            ))}
          </Stack>
        )}
      </Drawer>
    </Stack>
  );
}
export function EpicBrowser({
  epics,
  stories,
}: {
  epics: Epic[];
  stories: StoryDetail[];
}) {
  const [selected, setSelected] = useState<Epic | null>(null);
  return (
    <Stack gap="xl">
      <div>
        <Title order={1}>Epics</Title>
        <Text c="dimmed">
          {epics.length} epics · {stories.length} stories
        </Text>
      </div>
      {epics.map((e) => (
        <Paper withBorder p="xl" key={e.id}>
          <Stack>
            <Group justify="space-between">
              <Title order={3}>{e.title}</Title>
              <Badge color={e.status === "done" ? "green" : "gray"}>
                {e.status}
              </Badge>
            </Group>
            <Text c="dimmed" lineClamp={2}>
              {e.description.split("As a ")[0]}
            </Text>
            <Group justify="space-between">
              <Text size="sm">
                {e.completedStories}/{e.totalStories} stories completed
              </Text>
              <Button variant="light" onClick={() => setSelected(e)}>
                View stories
              </Button>
            </Group>
          </Stack>
        </Paper>
      ))}
      <Drawer
        opened={!!selected}
        onClose={() => setSelected(null)}
        title="Epic stories"
        position="right"
        size="xl"
      >
        {selected && (
          <StoryBrowser
            stories={stories.filter((s) => s.epicId === selected.id)}
            epics={[selected]}
          />
        )}
      </Drawer>
    </Stack>
  );
}
function flatten(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes.flatMap((n) =>
    n.type === "file" ? [n] : flatten(n.children ?? []),
  );
}
export function Library({
  fileTree,
  docsTree,
  bmadCoreTree,
  owner,
  repo,
  initialSelectedFile,
}: {
  fileTree: FileTreeNode[];
  docsTree?: FileTreeNode[];
  bmadCoreTree?: FileTreeNode[];
  owner: string;
  repo: string;
  initialSelectedFile?: string;
}) {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState<string | null>("documents"),
    [selected, setSelected] = useState(initialSelectedFile ?? ""),
    [file, setFile] = useState<ParsedBmadFile | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const files = [
    ...new Map(
      flatten([...fileTree, ...(docsTree ?? []), ...(bmadCoreTree ?? [])]).map(
        (n) => [n.path, n],
      ),
    ).values(),
  ].sort((a, b) => {
    const rank = (n: FileTreeNode) =>
      n.path.includes("planning-artifacts")
        ? 0
        : n.path.includes("implementation-artifacts")
          ? 1
          : 2;
    return rank(a) - rank(b) || a.name.localeCompare(b.name);
  });
  const visible = files.filter(
    (n) =>
      n.path.toLowerCase().includes(search.toLowerCase()) &&
      (category !== "documents" ||
        /\.(md|yaml|yml|toml|json|txt)$/i.test(n.name)) &&
      (category !== "images" || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(n.name)),
  );
  useEffect(() => {
    if (!selected) return;
    let active = true;
    void fetchParsedFileContent({ owner, name: repo, path: selected })
      .then((r) => {
        if (active) {
          setLoading(false);
          if (r.success) {
            setFile(r.data);
            setError("");
          } else setError(r.error);
        }
      })
      .catch(() => {
        if (active) {
          setLoading(false);
          setError("Unable to load document");
        }
      });
    return () => {
      active = false;
    };
  }, [selected, owner, repo]);
  return (
    <Stack gap="lg">
      <div>
        <Title order={1}>Library</Title>
        <Text c="dimmed">
          Requirements, architecture, and implementation documents.
        </Text>
      </div>
      <Group>
        <TextInput
          placeholder="Find an artifact"
          aria-label="Find an artifact"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: "1 1 240px" }}
        />
        <Select
          aria-label="Artifact category"
          value={category}
          onChange={setCategory}
          data={[
            { value: "documents", label: "Documents" },
            { value: "images", label: "Images" },
            { value: "all", label: "All artifacts" },
          ]}
        />
      </Group>
      <SimpleGrid
        cols={{ base: 1, md: 2 }}
        spacing="xl"
        style={{ gridTemplateColumns: undefined }}
      >
        <Paper withBorder p="md">
          <Text fw={600} mb="md">
            {visible.length} artifacts
          </Text>
          <ScrollArea h={500}>
            <Stack gap={4}>
              {visible.map((n) => (
                <Button
                  key={n.path}
                  variant={n.path === selected ? "light" : "subtle"}
                  justify="flex-start"
                  h="auto"
                  py="sm"
                  onClick={() => {
                    setSelected(n.path);
                    setLoading(true);
                    const url = new URL(window.location.href);
                    url.searchParams.set("file", n.path);
                    window.history.replaceState(null, "", url);
                  }}
                >
                  <Stack gap={2} align="start" style={{ minWidth: 0 }}>
                    <Text
                      size="sm"
                      style={{
                        whiteSpace: "normal",
                        overflowWrap: "anywhere",
                        textAlign: "left",
                      }}
                    >
                      {n.name}
                    </Text>
                    <Text
                      size="xs"
                      c="dimmed"
                      style={{
                        whiteSpace: "normal",
                        overflowWrap: "anywhere",
                        textAlign: "left",
                      }}
                    >
                      {n.path}
                    </Text>
                  </Stack>
                </Button>
              ))}
            </Stack>
          </ScrollArea>
        </Paper>
        <Paper withBorder p="xl" style={{ minWidth: 0 }}>
          {error ? (
            <Alert color="red">{error}</Alert>
          ) : loading ? (
            <Text>Loading artifact…</Text>
          ) : file ? (
            <Stack>
              <Text fw={600} style={{ overflowWrap: "anywhere" }}>
                {selected.split("/").pop()}
              </Text>
              {file.contentType === "image" ? (
                <Image
                  unoptimized
                  width={1200}
                  height={800}
                  src={
                    "/api/repo/" +
                    owner +
                    "/" +
                    repo +
                    "/raw?path=" +
                    encodeURIComponent(selected)
                  }
                  alt={selected.split("/").pop() ?? "Project image"}
                  style={{ maxWidth: "100%", height: "auto" }}
                />
              ) : file.contentType === "markdown" ? (
                <MarkdownRenderer
                  content={file.body}
                  owner={owner}
                  repo={repo}
                  currentFilePath={selected}
                />
              ) : (
                <pre style={{ overflow: "auto", fontSize: 14 }}>
                  {file.rawContent}
                </pre>
              )}
            </Stack>
          ) : (
            <Text c="dimmed">Choose a document to read it here.</Text>
          )}
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}
