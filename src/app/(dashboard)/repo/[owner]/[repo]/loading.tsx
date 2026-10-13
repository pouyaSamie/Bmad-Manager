import { Skeleton, Stack } from "@mantine/core";
export default function Loading() {
  return (
    <Stack aria-label="Loading workspace">
      <Skeleton height={40} width="40%" />
      <Skeleton height={160} />
      <Skeleton height={160} />
    </Stack>
  );
}
