"use client";
import Link from "next/link";
import { Alert, Button, Group, Stack } from "@mantine/core";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <Stack>
      <Alert color="red" title="Unable to load this project">
        Check project access and the source folder or GitHub connection.
      </Alert>
      <Group>
        <Button onClick={reset}>Try again</Button>
        <Button component={Link} href="/" variant="light">
          Back to projects
        </Button>
      </Group>
    </Stack>
  );
}
