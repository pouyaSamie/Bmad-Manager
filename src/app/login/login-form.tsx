"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import {
  Paper,
  Stack,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Alert,
  Divider,
} from "@mantine/core";
interface LoginFormProps {
  githubEnabled: boolean;
  registrationEnabled: boolean;
}

export function LoginForm({
  githubEnabled,
  registrationEnabled,
}: LoginFormProps) {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlError = searchParams.get("error");

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (isSignUp && !name.trim()) {
      setError("Name is required to create an account.");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const result = await authClient.signUp.email({
          email,
          password,
          name: name.trim(),
        });
        if (result.error) {
          // Use a single ambiguous message for all non-403 failures so the
          // client cannot distinguish "email already registered" (422) from
          // any other error — preventing account enumeration.
          const code = result.error.status;
          setError(
            code === 403
              ? "Registration is disabled on this server."
              : "Unable to create the account.",
          );
          setLoading(false);
          return;
        }
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
        });
        if (result.error) {
          setError("Incorrect email or password.");
          setLoading(false);
          return;
        }
      }
      router.push("/");
    } catch {
      setError("An unexpected error occurred.");
      setLoading(false);
    }
  }

  const displayError =
    error ??
    (urlError === "session_expired"
      ? "Your session has expired. Please sign in again."
      : urlError
        ? "Sign-in failed. Please try again."
        : null);

  return (
    <Paper withBorder p="xl" radius="lg" w="100%" maw={460}>
      <Stack gap="lg">
        <div>
          <Text c="indigo" fw={700} mb="md">
            BMAD MANAGER
          </Text>
          <Title order={2}>
            {isSignUp ? "Create your workspace" : "Welcome back"}
          </Title>
          <Text c="dimmed" mt="sm">
            Configure your AI team and design how they work together.
          </Text>
        </div>
        {displayError && <Alert color="red">{displayError}</Alert>}
        <form onSubmit={handleEmailSubmit}>
          <Stack>
            {isSignUp && (
              <TextInput
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            )}
            <TextInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <PasswordInput
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              required
            />
            <Button type="submit" loading={loading} fullWidth>
              {isSignUp ? "Create account" : "Sign in"}
            </Button>
          </Stack>
        </form>
        {githubEnabled && (
          <>
            <Divider label="or" />
            <Button
              variant="default"
              onClick={() =>
                authClient.signIn.social({
                  provider: "github",
                  callbackURL: "/",
                })
              }
            >
              Continue with GitHub
            </Button>
          </>
        )}
        {registrationEnabled && (
          <Button
            variant="subtle"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Create an account"}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
