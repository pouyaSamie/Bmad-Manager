"use client";
import { useEffect, useState } from "react";
import {
  Title,
  Text,
  Stack,
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Alert,
  SimpleGrid,
  Badge,
} from "@mantine/core";
import { authClient } from "@/lib/auth/auth-client";
export default function Profile() {
  const { data: session } = authClient.useSession();
  const [name, setName] = useState(""),
    [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [credential, setCredential] = useState(false);
  useEffect(() => {
    void authClient
      .listAccounts()
      .then((r) =>
        setCredential(
          r.data?.some((a) => a.providerId === "credential") ?? false,
        ),
      );
  }, []);
  return (
    <Stack gap="xl">
      <div>
        <Title order={1}>Profile</Title>
        <Text c="dimmed">Your account and sign-in settings.</Text>
      </div>
      {error && <Alert color="red">{error}</Alert>}
      {notice && <Alert color="green">{notice}</Alert>}
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Paper withBorder p="xl">
          <Stack>
            <Title order={3}>Account</Title>
            <Text>{session?.user.email}</Text>
            <Badge>{session?.user.role ?? "user"}</Badge>
            <TextInput
              label="Display name"
              placeholder={session?.user.name ?? "Your name"}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              loading={busy}
              disabled={!name.trim()}
              onClick={async () => {
                setBusy(true);
                const r = await authClient.updateUser({ name: name.trim() });
                setBusy(false);
                if (r.error) setError("Unable to update your profile");
                else setNotice("Profile updated");
              }}
            >
              Update name
            </Button>
          </Stack>
        </Paper>
        {credential && (
          <Paper withBorder p="xl">
            <Stack>
              <Title order={3}>Change password</Title>
              <PasswordInput
                label="Current password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
              <PasswordInput
                label="New password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <PasswordInput
                label="Confirm password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <Button
                loading={busy}
                onClick={async () => {
                  setError("");
                  if (
                    password.length < 8 ||
                    password !== confirm ||
                    password === current
                  ) {
                    setError(
                      "Choose a new password of at least 8 characters and confirm it",
                    );
                    return;
                  }
                  setBusy(true);
                  const r = await authClient.changePassword({
                    currentPassword: current,
                    newPassword: password,
                    revokeOtherSessions: true,
                  });
                  setBusy(false);
                  if (r.error)
                    setError(
                      "Unable to change password. Check your current password.",
                    );
                  else {
                    setCurrent("");
                    setPassword("");
                    setConfirm("");
                    setNotice("Password updated. Other sessions were revoked.");
                  }
                }}
              >
                Change password
              </Button>
            </Stack>
          </Paper>
        )}
      </SimpleGrid>
    </Stack>
  );
}
