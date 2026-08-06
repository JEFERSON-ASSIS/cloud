"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/password/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = (await response.json()) as {
      message?: string;
      error?: string;
    };
    setMessage(data.message ?? data.error ?? "Não foi possível concluir.");
  };
  return (
    <Box
      sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2 }}
    >
      <Card sx={{ width: "100%", maxWidth: 460 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4">Definir nova senha</Typography>
          <Typography color="text.secondary" sx={{ my: 2 }}>
            Use ao menos 12 caracteres.
          </Typography>
          {message && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {message}
            </Alert>
          )}
          <Stack component="form" spacing={2} onSubmit={submit}>
            <TextField
              label="Nova senha"
              type="password"
              required
              slotProps={{ htmlInput: { minLength: 12 } }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" variant="contained" disabled={!token}>
              Alterar senha
            </Button>
            <Button component={Link} href="/login">
              Voltar ao login
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Box sx={{ minHeight: "100vh" }} />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
