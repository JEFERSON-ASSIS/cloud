"use client";
import { Button, Stack, Typography } from "@mui/material";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Stack spacing={2} sx={{ py: 10, alignItems: "center" }}>
      <Typography variant="h5">
        Não foi possível carregar esta página.
      </Typography>
      <Typography color="text.secondary">
        Tente novamente. Se o problema continuar, consulte os logs do serviço.
      </Typography>
      <Button variant="contained" onClick={reset}>
        Tentar novamente
      </Button>
    </Stack>
  );
}
