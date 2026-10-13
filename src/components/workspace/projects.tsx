"use client";
import Link from "next/link";
import {
  Title,
  Text,
  Stack,
  Group,
  Button,
  Paper,
  SimpleGrid,
  Badge,
  Progress,
  Alert,
} from "@mantine/core";
import {
  ArrowUpRight,
  FolderOpen,
  Plus,
  Workflow,
  Users,
  BookOpen,
} from "lucide-react";
import { AddRepoDialog } from "@/components/layout/add-repo-dialog";
import type { BmadProject } from "@/lib/bmad/types";
import type { RepoConfig } from "@/lib/types";
export function Projects({
  projects,
  repos,
  errors,
  localFsEnabled,
  githubEnabled,
}: {
  projects: BmadProject[];
  repos: RepoConfig[];
  errors: string[];
  localFsEnabled: boolean;
  githubEnabled: boolean;
}) {
  const done = projects.reduce((n, p) => n + p.completedStories, 0),
    total = projects.reduce((n, p) => n + p.totalStories, 0);
  return (
    <Stack gap="xl">
      <Group justify="space-between">
        <div>
          <Text c="dimmed" size="sm" mb="xs">
            YOUR WORKSPACE
          </Text>
          <Title order={1}>Projects</Title>
          <Text c="dimmed" mt={6}>
            A clear view of your projects. A place to shape your AI team.
          </Text>
        </div>
        <AddRepoDialog
          importedRepos={repos}
          localFsEnabled={localFsEnabled}
          githubEnabled={githubEnabled}
          trigger={
            <Button leftSection={<Plus size={18} />}>Add project</Button>
          }
        />
      </Group>
      <Group gap="xl">
        <Text>
          <strong>{repos.length}</strong> projects
        </Text>
        <Text c="dimmed">
          {done} of {total} stories completed
        </Text>
        <Button component={Link} href="/connections" variant="subtle">
          Manage connections →
        </Button>
      </Group>
      {errors.length > 0 && <Alert color="orange">{errors.join(" · ")}</Alert>}
      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
        {repos.map((r) => {
          const p = projects.find(
              (p) => p.owner === r.owner && p.repo === r.name,
            ),
            base = "/repo/" + r.owner + "/" + r.name;
          return (
            <Paper key={base} withBorder p="xl" radius="lg">
              <Stack gap="lg">
                <Group justify="space-between">
                  <Badge color="gray" variant="light">
                    {r.sourceType === "local" ? "Local project" : "GitHub"}
                  </Badge>
                  <FolderOpen size={20} color="var(--mantine-color-dimmed)" />
                </Group>
                <div>
                  <Title order={3}>{r.displayName}</Title>
                  <Text c="dimmed" size="sm" lineClamp={2} mt="sm">
                    {r.description ||
                      "Configure agents and design a workflow for this project."}
                  </Text>
                </div>
                {p ? (
                  <>
                    <Group justify="space-between">
                      <Text size="sm">
                        {p.epics.length} epics · {p.totalStories} stories
                      </Text>
                      <Text size="sm">
                        {p.totalStories
                          ? Math.round(
                              (p.completedStories / p.totalStories) * 100,
                            )
                          : 0}
                        %
                      </Text>
                    </Group>
                    <Progress
                      value={
                        p.totalStories
                          ? (p.completedStories / p.totalStories) * 100
                          : 0
                      }
                      size={6}
                    />
                  </>
                ) : (
                  <Text c="dimmed" size="sm">
                    No delivery artifacts yet
                  </Text>
                )}
                <Button
                  component={Link}
                  href={base}
                  variant="light"
                  rightSection={<ArrowUpRight size={18} />}
                >
                  Open project
                </Button>
              </Stack>
            </Paper>
          );
        })}
      </SimpleGrid>
      {!repos.length && (
        <Paper withBorder p="xl">
          <Title order={3}>Start with your project folder</Title>
          <Text c="dimmed" mt="sm">
            Import a project, connect a model, and configure your first agent.
          </Text>
        </Paper>
      )}
    </Stack>
  );
}
export function ProjectOverview({
  project,
  repo,
}: {
  project: BmadProject | null;
  repo: RepoConfig;
}) {
  const base = "/repo/" + repo.owner + "/" + repo.name;
  return (
    <Stack gap="xl">
      <Group justify="space-between">
        <div>
          <Text c="dimmed" size="sm">
            PROJECT OVERVIEW
          </Text>
          <Title order={1} mt="xs">
            {repo.displayName}
          </Title>
          <Text c="dimmed" mt="sm">
            {repo.description ??
              "Configure your team and keep project artifacts within reach."}
          </Text>
        </div>
        <Button component={Link} href={base + "/settings"} variant="default">
          Project settings
        </Button>
      </Group>
      <SimpleGrid cols={{ base: 1, md: 3 }}>
        {[
          [
            "agents",
            "Your AI team",
            "Assign models and test agent conversations.",
            Users,
          ],
          [
            "workflow",
            "Workflow design",
            "Connect agents and configure feedback loops.",
            Workflow,
          ],
          [
            "docs",
            "Project library",
            "Read requirements, architecture, and implementation artifacts.",
            BookOpen,
          ],
        ].map(([segment, label, description, Icon]) => {
          const Component = Icon as typeof Users;
          return (
            <Paper key={String(segment)} withBorder p="xl">
              <Component size={24} color="var(--mantine-color-indigo-6)" />
              <Title order={3} mt="md">
                {String(label)}
              </Title>
              <Text c="dimmed" size="sm" mt="sm">
                {String(description)}
              </Text>
              <Button
                component={Link}
                href={base + "/" + segment}
                variant="subtle"
                mt="md"
              >
                Open →
              </Button>
            </Paper>
          );
        })}
      </SimpleGrid>
      <Paper withBorder p="xl">
        <Group justify="space-between">
          <Title order={3}>Delivery artifacts</Title>
          <Badge color="gray">Existing project data</Badge>
        </Group>
        <Group mt="lg" gap="xl">
          <Text>
            <strong>{project?.epics.length ?? 0}</strong> epics
          </Text>
          <Text>
            <strong>{project?.totalStories ?? 0}</strong> stories
          </Text>
          <Text>
            <strong>{project?.completedStories ?? 0}</strong> completed
          </Text>
        </Group>
        <Text size="sm" c="dimmed" mt="sm">
          These counts describe imported artifacts. Workflow execution is not
          enabled in this release.
        </Text>
        <Group mt="lg">
          <Button component={Link} href={base + "/epics"} variant="light">
            Browse epics
          </Button>
          <Button component={Link} href={base + "/stories"} variant="light">
            Browse stories
          </Button>
        </Group>
      </Paper>
      <Text size="xs" c="dimmed" style={{ overflowWrap: "anywhere" }}>
        Source:{" "}
        {repo.sourceType === "local"
          ? repo.localPath
          : repo.owner + "/" + repo.name}{" "}
        ·{" "}
        {repo.lastSyncedAt
          ? "Last synced " + new Date(repo.lastSyncedAt).toLocaleString()
          : "Not synced yet"}
      </Text>
    </Stack>
  );
}
