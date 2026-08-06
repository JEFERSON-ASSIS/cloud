import { Chip } from "@mui/material";
export function StatusChip({ status }: { status: string }) {
  const good = ["ACTIVE", "COMPLETED", "CONNECTED"].includes(status);
  const bad = ["FAILED", "ERROR", "BLOCKED"].includes(status);
  return (
    <Chip
      size="small"
      label={status}
      color={good ? "success" : bad ? "error" : "default"}
      variant="outlined"
    />
  );
}
