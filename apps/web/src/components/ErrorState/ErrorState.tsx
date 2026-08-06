import { Alert } from "@mui/material";
export function ErrorState({
  message = "Não foi possível carregar os dados.",
}: {
  message?: string;
}) {
  return <Alert severity="error">{message}</Alert>;
}
