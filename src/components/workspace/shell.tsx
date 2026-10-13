"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AppShell,
  Group,
  Text,
  Select,
  NavLink,
  Stack,
  Button,
  ActionIcon,
  Burger,
  Menu,
  Divider,
  useMantineColorScheme,
  Badge,
} from "@mantine/core";
import {
  LayoutGrid,
  Plug,
  Users,
  Workflow,
  BookOpen,
  Layers,
  ListChecks,
  Settings,
  Sun,
  Moon,
  Plus,
  LogOut,
  Shield,
  User,
} from "lucide-react";
import { authClient } from "@/lib/auth/auth-client";
import { AddRepoDialog } from "@/components/layout/add-repo-dialog";
import type { RepoConfig } from "@/lib/types";
const sections = [
  ["", "Overview", LayoutGrid],
  ["agents", "Agents", Users],
  ["workflow", "Workflow", Workflow],
  ["docs", "Library", BookOpen],
  ["epics", "Epics", Layers],
  ["stories", "Stories", ListChecks],
  ["settings", "Settings", Settings],
] as const;
export function WorkspaceShell({
  children,
  repos,
  email,
  admin,
  localFsEnabled,
  githubEnabled,
  pending,
}: {
  children: React.ReactNode;
  repos: RepoConfig[];
  email: string;
  admin: boolean;
  localFsEnabled: boolean;
  githubEnabled: boolean;
  pending: Record<string, number>;
}) {
  const pathname = usePathname(),
    router = useRouter();
  const [opened, setOpened] = useState(false);
  const { toggleColorScheme } = useMantineColorScheme();
  const project = repos.find((r) =>
    pathname.startsWith("/repo/" + r.owner + "/" + r.name),
  );
  const base = project ? "/repo/" + project.owner + "/" + project.name : "";
  const section = sections.find(
    ([segment]) => pathname === base + (segment ? "/" + segment : ""),
  );
  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: 264, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding={{ base: 16, sm: 28 }}
    >
      <AppShell.Header>
        <Group h="100%" px="lg" justify="space-between" wrap="nowrap">
          <Group wrap="nowrap" gap="sm">
            <Burger
              opened={opened}
              onClick={() => setOpened(!opened)}
              hiddenFrom="sm"
              aria-label="Toggle navigation"
              size="sm"
            />
            <Text component={Link} href="/" fw={750} size="lg">
              Bmad<span className="workspace-muted"> Manager</span>
            </Text>
            <Text visibleFrom="sm" c="dimmed" size="sm">
              / {project?.displayName ?? "Workspace"}{" "}
              {section && project ? " / " + section[1] : ""}
            </Text>
          </Group>
          <Group gap="xs">
            <ActionIcon
              variant="subtle"
              size="lg"
              aria-label="Toggle theme"
              onClick={toggleColorScheme}
            >
              <Sun size={20} className="theme-dark-icon" />
              <Moon size={20} className="theme-light-icon" />
            </ActionIcon>
            <Menu>
              <Menu.Target>
                <Button variant="light" size="sm" aria-label="Account">
                  {email.split("@")[0]}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  component={Link}
                  href="/profile"
                  leftSection={<User size={16} />}
                >
                  Profile
                </Menu.Item>
                {admin && (
                  <Menu.Item
                    component={Link}
                    href="/admin"
                    leftSection={<Shield size={16} />}
                  >
                    Administration
                  </Menu.Item>
                )}
                <Menu.Item
                  leftSection={<LogOut size={16} />}
                  onClick={async () => {
                    await authClient.signOut();
                    router.push("/login");
                  }}
                >
                  Sign out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md">
        <Stack gap="xs" h="100%">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb="xs">
            Workspace
          </Text>
          <NavLink
            component={Link}
            href="/"
            label="Projects"
            leftSection={<LayoutGrid size={19} />}
            active={pathname === "/"}
            onClick={() => setOpened(false)}
          />
          <NavLink
            component={Link}
            href="/connections"
            label="Connections"
            leftSection={<Plug size={19} />}
            active={pathname === "/connections"}
            onClick={() => setOpened(false)}
          />
          <Divider my="md" />
          <Select
            label="Project"
            placeholder="Choose a project"
            searchable
            value={project ? base : null}
            data={repos.map((r) => ({
              value: "/repo/" + r.owner + "/" + r.name,
              label: r.displayName,
            }))}
            onChange={(v) => {
              if (v) {
                router.push(v);
                setOpened(false);
              }
            }}
          />
          {project && (
            <>
              <Text size="xs" c="dimmed" mt="md">
                PROJECT WORKSPACE
              </Text>
              {sections.map(([segment, label, Icon]) => (
                <NavLink
                  key={label}
                  component={Link}
                  href={base + (segment ? "/" + segment : "")}
                  label={label}
                  leftSection={<Icon size={19} />}
                  active={pathname === base + (segment ? "/" + segment : "")}
                  onClick={() => setOpened(false)}
                  rightSection={
                    segment === "settings" && pending[base] ? (
                      <Badge size="sm">{pending[base]}</Badge>
                    ) : undefined
                  }
                />
              ))}
            </>
          )}
          <div style={{ flex: 1 }} />
          <AddRepoDialog
            importedRepos={repos}
            localFsEnabled={localFsEnabled}
            githubEnabled={githubEnabled}
            trigger={
              <Button fullWidth leftSection={<Plus size={18} />}>
                Add project
              </Button>
            }
          />
          <Text size="xs" c="dimmed" mt="sm">
            Configure. Test. Design.
          </Text>
        </Stack>
      </AppShell.Navbar>
      <AppShell.Main className="workspace-main">{children}</AppShell.Main>
    </AppShell>
  );
}
