import { Skeleton, Stack } from "@mui/material";
export function LoadingState() {
  return (
    <Stack spacing={1.5}>
      {[1, 2, 3].map((item) => (
        <Skeleton key={item} variant="rounded" height={64} />
      ))}
    </Stack>
  );
}
