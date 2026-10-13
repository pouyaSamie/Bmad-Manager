"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Paper,
  Stack,
  Title,
  Text,
  Group,
  Button,
  Modal,
  Select,
  Alert,
} from "@mantine/core";
import {
  deleteRepo,
  refreshRepoData,
  listRepoBranches,
  updateRepoBranch,
} from "@/actions/repo-actions";
import type { RepoConfig } from "@/lib/types";
export function ProjectLifecycle({ repo }: { repo: RepoConfig }) {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState("unlink"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [branches, setBranches] = useState<string[]>([]),
    [branch, setBranch] = useState(repo.branch);
  return (
    <Stack>
      {error && <Alert color="red">{error}</Alert>}
      {notice && <Alert color="green">{notice}</Alert>}
      <Paper withBorder p="xl">
        <Stack>
          <Title order={3}>Project source</Title>
          <Text size="sm" c="dimmed" style={{ overflowWrap: "anywhere" }}>
            {repo.localPath ?? repo.owner + "/" + repo.name}
          </Text>
          <Group>
            <Button
              variant="default"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                const r = await refreshRepoData({
                  owner: repo.owner,
                  name: repo.name,
                });
                setBusy(false);
                if (!r.success) setError(r.error);
                else {
                  setNotice("Project artifacts refreshed");
                  router.refresh();
                }
              }}
            >
              Refresh artifacts
            </Button>
            {repo.sourceType !== "local" && (
              <Button
                variant="light"
                onClick={async () => {
                  const r = await listRepoBranches({
                    owner: repo.owner,
                    name: repo.name,
                  });
                  if (r.success) setBranches(r.data);
                  else setError(r.error);
                }}
              >
                Choose branch
              </Button>
            )}
          </Group>
          {branches.length > 0 && (
            <Group align="end">
              <Select
                label="Branch"
                data={branches}
                value={branch}
                onChange={(v) => setBranch(v ?? repo.branch)}
              />
              <Button
                onClick={async () => {
                  const r = await updateRepoBranch({
                    owner: repo.owner,
                    name: repo.name,
                    branch,
                  });
                  if (!r.success) setError(r.error);
                  else router.refresh();
                }}
              >
                Save branch
              </Button>
            </Group>
          )}
        </Stack>
      </Paper>
      <Paper withBorder p="xl">
        <Group justify="space-between">
          <div>
            <Title order={3}>Remove project</Title>
            <Text size="sm" c="dimmed">
              Unlinking preserves the folder, source code, BMad files, and Git
              history.
            </Text>
          </div>
          <Button color="red" variant="light" onClick={() => setOpen(true)}>
            Remove project
          </Button>
        </Group>
      </Paper>
      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title={"Remove " + repo.displayName}
      >
        <Stack>
          <Select
            label="Removal option"
            value={mode}
            onChange={(v) => setMode(v ?? "unlink")}
            data={[
              {
                value: "unlink",
                label: "Unlink from dashboard (safe default)",
              },
              ...(repo.sourceType === "local"
                ? [{ value: "uninstall", label: "Draft full BMad uninstall" }]
                : []),
            ]}
          />
          <Alert color={mode === "unlink" ? "indigo" : "orange"}>
            {mode === "unlink"
              ? "Only the dashboard record is removed. Local files remain untouched."
              : "Create a reviewable uninstall draft. The worker removes BMad assets after approval, then unlinks the project. Source code and Git are preserved."}
          </Alert>
          <Button
            color="red"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const r = await deleteRepo({
                owner: repo.owner,
                name: repo.name,
                uninstallBmad: mode === "uninstall",
              });
              setBusy(false);
              if (!r.success) {
                setError(r.error);
                return;
              }
              setOpen(false);
              if (r.data.deleted) router.push("/");
              else
                setNotice(
                  "Uninstall drafted. Review the change above before approving.",
                );
              router.refresh();
            }}
          >
            {mode === "unlink" ? "Unlink project" : "Draft uninstall"}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
