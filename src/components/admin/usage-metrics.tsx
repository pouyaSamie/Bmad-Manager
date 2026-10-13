"use client";
import { SimpleGrid, Paper, Text, Title } from "@mantine/core";
export function UsageMetrics(props: {
  totalUsers: number;
  totalRepos: number;
  recentUsers: number;
  activeUsersLast30d: number;
  parsingErrorRate: number | null;
}) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
      {[
        ["Users", props.totalUsers],
        ["Projects", props.totalRepos],
        ["New users", props.recentUsers],
        ["Active users", props.activeUsersLast30d],
      ].map(([label, value]) => (
        <Paper withBorder p="xl" key={label}>
          <Text c="dimmed">{label}</Text>
          <Title order={2} mt="sm">
            {value}
          </Title>
        </Paper>
      ))}
    </SimpleGrid>
  );
}
