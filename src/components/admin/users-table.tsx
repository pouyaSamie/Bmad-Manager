"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Stack,
  TextInput,
  Paper,
  Group,
  Text,
  Select,
  Alert,
  Title,
} from "@mantine/core";
import { updateUserRole, type AdminUser } from "@/actions/admin-actions";
export function UsersTable({
  users,
  currentUserId,
}: {
  users: AdminUser[];
  currentUserId: string;
}) {
  const [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  const router = useRouter();
  return (
    <Stack>
      <Title order={3}>Users</Title>
      {error && <Alert color="red">{error}</Alert>}
      <TextInput
        label="Find user"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {users
        .filter((u) =>
          (u.name + " " + u.email).toLowerCase().includes(search.toLowerCase()),
        )
        .map((u) => (
          <Paper withBorder p="lg" key={u.id}>
            <Group justify="space-between">
              <div>
                <Text fw={600}>{u.name ?? "Unnamed user"}</Text>
                <Text c="dimmed" size="sm">
                  {u.email} · {u._count.repos} projects
                </Text>
              </div>
              <Select
                aria-label={"Role for " + u.email}
                value={u.role}
                data={["user", "admin"]}
                disabled={u.id === currentUserId || busy === u.id}
                onChange={async (v) => {
                  if (!v) return;
                  setBusy(u.id);
                  const r = await updateUserRole({
                    userId: u.id,
                    newRole: v as "user" | "admin",
                  });
                  setBusy("");
                  if (!r.success) setError(r.error);
                  else router.refresh();
                }}
              />
            </Group>
          </Paper>
        ))}
    </Stack>
  );
}
