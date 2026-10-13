"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Modal,
  Button,
  Stack,
  Text,
  TextInput,
  Group,
  Stepper,
  Checkbox,
  Select,
  Alert,
  ScrollArea,
  Tabs,
  Paper,
} from "@mantine/core";
import {
  getAvailableLocalProjects,
  importLocalFolder,
  listUserRepos,
  importRepo,
} from "@/actions/repo-actions";
import type { AvailableLocalProject } from "@/lib/path-utils";
import type { GitHubRepo } from "@/lib/github/types";
import type { BmadInstallOptions } from "@/lib/bmad-control";
export function AddRepoDialog({
  trigger,
  importedRepos = [],
  localFsEnabled = false,
  githubEnabled = true,
}: {
  trigger?: React.ReactNode;
  importedRepos?: {
    owner: string;
    name: string;
    displayName?: string;
    localPath?: string | null;
  }[];
  localFsEnabled?: boolean;
  githubEnabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [step, setStep] = useState(0),
    [projects, setProjects] = useState<AvailableLocalProject[]>([]),
    [github, setGithub] = useState<GitHubRepo[]>([]),
    [folder, setFolder] = useState(""),
    [hasBmad, setHasBmad] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [options, setOptions] = useState<BmadInstallOptions>({
    tools: ["codex"],
    modules: ["bmm"],
    userName: "Developer",
    outputFolder: "_bmad-output",
    communicationLanguage: "English",
    documentOutputLanguage: "English",
    channel: "stable",
    shims: false,
  });
  const normalize = (p: string) =>
    p.replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  const existing = (p: AvailableLocalProject) =>
    importedRepos.find(
      (r) =>
        r.localPath &&
        (normalize(r.localPath) === normalize(p.path) ||
          normalize(r.localPath) === normalize(p.displayPath)),
    );
  async function show() {
    setOpen(true);
    setStep(0);
    setError("");
    setBusy(true);
    try {
      if (localFsEnabled) {
        const r = await getAvailableLocalProjects();
        if (r.success) setProjects(r.data);
        else setError(r.error);
      }
      if (githubEnabled) {
        const r = await listUserRepos();
        if (r.success) setGithub(r.data);
      }
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    setBusy(true);
    setError("");
    try {
      const r = await importLocalFolder({
        localPath: folder,
        installOptions: options,
      });
      if (!r.success) {
        setError(r.error);
        return;
      }
      setOpen(false);
      router.push("/repo/" + r.data.owner + "/" + r.data.name + "/settings");
      router.refresh();
    } catch {
      setError("Unable to import this project. Check folder access.");
    } finally {
      setBusy(false);
    }
  }
  function toggle(field: "tools" | "modules", value: string, on: boolean) {
    setOptions((o) => ({
      ...o,
      [field]: on
        ? [...(o[field] ?? []), value]
        : (o[field] ?? []).filter((x) => x !== value),
    }));
  }
  return (
    <>
      <div onClick={show} style={{ cursor: "pointer" }}>
        {trigger ?? <Button>Add project</Button>}
      </div>
      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title="Add a project"
        size="lg"
      >
        <Stack>
          <Stepper active={step} size="xs">
            <Stepper.Step label="Choose" />
            <Stepper.Step label="Configure" />
            <Stepper.Step label="Review" />
          </Stepper>
          {error && <Alert color="red">{error}</Alert>}
          {step === 0 ? (
            <Tabs defaultValue={localFsEnabled ? "local" : "github"}>
              <Tabs.List>
                {localFsEnabled && (
                  <Tabs.Tab value="local">Local folder</Tabs.Tab>
                )}
                {githubEnabled && <Tabs.Tab value="github">GitHub</Tabs.Tab>}
              </Tabs.List>
              <Tabs.Panel value="local" pt="md">
                <Stack>
                  <Text c="dimmed" size="sm">
                    Choose an existing folder. Installation changes are reviewed
                    before the worker applies them.
                  </Text>
                  <ScrollArea h={240}>
                    <Stack gap="xs">
                      {projects.map((p) => {
                        const imported = existing(p);
                        return (
                          <Paper key={p.path} withBorder p="md">
                            <Group justify="space-between" wrap="nowrap">
                              <div style={{ minWidth: 0 }}>
                                <Text fw={600}>{p.name}</Text>
                                <Text
                                  size="xs"
                                  c="dimmed"
                                  style={{ overflowWrap: "anywhere" }}
                                >
                                  {p.displayPath}
                                </Text>
                              </div>
                              <Button
                                variant="light"
                                size="sm"
                                onClick={() => {
                                  if (imported) {
                                    setOpen(false);
                                    router.push(
                                      "/repo/" +
                                        imported.owner +
                                        "/" +
                                        imported.name,
                                    );
                                  } else {
                                    setFolder(p.path);
                                    setHasBmad(p.hasBmad);
                                    setStep(p.hasBmad ? 2 : 1);
                                  }
                                }}
                              >
                                {imported ? "Open project" : "Select"}
                              </Button>
                            </Group>
                          </Paper>
                        );
                      })}
                      {busy && <Text>Inspecting available folders…</Text>}
                    </Stack>
                  </ScrollArea>
                  <TextInput
                    label="Folder path"
                    description="For an existing folder outside the detected list"
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    placeholder="C:/workspace/my-project"
                  />
                  <Button
                    disabled={!folder.trim()}
                    onClick={() => {
                      setHasBmad(false);
                      setStep(1);
                    }}
                  >
                    Continue
                  </Button>
                </Stack>
              </Tabs.Panel>
              <Tabs.Panel value="github" pt="md">
                <Stack>
                  {github.map((r) => (
                    <Paper key={r.fullName} p="md" withBorder>
                      <Group justify="space-between">
                        <Text>{r.fullName}</Text>
                        <Button
                          size="sm"
                          variant="light"
                          onClick={async () => {
                            setBusy(true);
                            const out = await importRepo({
                              owner: r.owner,
                              name: r.name,
                              defaultBranch: r.defaultBranch,
                              fullName: r.fullName,
                              description: r.description,
                            });
                            setBusy(false);
                            if (out.success) {
                              setOpen(false);
                              router.push("/repo/" + r.owner + "/" + r.name);
                              router.refresh();
                            } else setError(out.error);
                          }}
                          loading={busy}
                        >
                          Import
                        </Button>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              </Tabs.Panel>
            </Tabs>
          ) : step === 1 ? (
            <Stack>
              <Text fw={600}>BMad installation preferences</Text>
              <Checkbox.Group label="Tools / IDEs" value={options.tools}>
                {[
                  ["codex", "Codex"],
                  ["antigravity", "Antigravity"],
                  ["claude-code", "Claude Code"],
                  ["cursor", "Cursor"],
                  ["github-copilot", "GitHub Copilot"],
                ].map(([v, l]) => (
                  <Checkbox
                    key={v}
                    label={l}
                    value={v}
                    checked={options.tools?.includes(v)}
                    onChange={(e) => toggle("tools", v, e.target.checked)}
                  />
                ))}
              </Checkbox.Group>
              <Checkbox.Group label="Modules" value={options.modules}>
                {[
                  ["bmm", "BMad Method"],
                  ["bmb", "BMad Builder"],
                ].map(([v, l]) => (
                  <Checkbox
                    key={v}
                    label={l}
                    value={v}
                    checked={options.modules?.includes(v)}
                    onChange={(e) => toggle("modules", v, e.target.checked)}
                  />
                ))}
              </Checkbox.Group>
              <TextInput
                label="User name"
                value={options.userName}
                onChange={(e) =>
                  setOptions({ ...options, userName: e.target.value })
                }
              />
              <TextInput
                label="Output folder"
                value={options.outputFolder}
                onChange={(e) =>
                  setOptions({ ...options, outputFolder: e.target.value })
                }
              />
              {(
                ["communicationLanguage", "documentOutputLanguage"] as const
              ).map((field) => (
                <Select
                  key={field}
                  label={
                    field === "communicationLanguage"
                      ? "Conversation language"
                      : "Document language"
                  }
                  data={[
                    "English",
                    "Persian",
                    "Spanish",
                    "French",
                    "German",
                    "Japanese",
                    "Chinese",
                    "Arabic",
                  ]}
                  value={options[field]}
                  onChange={(v) =>
                    setOptions({ ...options, [field]: v ?? "English" })
                  }
                />
              ))}
              <Select
                label="Release channel"
                data={["stable", "next"]}
                value={options.channel}
                onChange={(v) =>
                  setOptions({ ...options, channel: v as "stable" | "next" })
                }
              />
              <Group justify="space-between">
                <Button variant="subtle" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button
                  disabled={!options.tools?.length || !options.modules?.length}
                  onClick={() => setStep(2)}
                >
                  Review
                </Button>
              </Group>
            </Stack>
          ) : (
            <Stack>
              <Text fw={600} style={{ overflowWrap: "anywhere" }}>
                {folder}
              </Text>
              <Alert color="indigo">
                {hasBmad
                  ? "Import the installed project. No installation will be submitted."
                  : "The folder will be inspected on import. If BMad is missing, an installation draft will be created for review in Project Settings. No files are changed by importing."}
              </Alert>
              {!hasBmad && (
                <Text size="sm">
                  Tools: {options.tools?.join(", ")} · Modules:{" "}
                  {options.modules?.join(", ")} ·{" "}
                  {options.communicationLanguage}
                </Text>
              )}
              <Group justify="space-between">
                <Button variant="subtle" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button loading={busy} onClick={finish}>
                  Import project
                </Button>
              </Group>
            </Stack>
          )}
        </Stack>
      </Modal>
    </>
  );
}
