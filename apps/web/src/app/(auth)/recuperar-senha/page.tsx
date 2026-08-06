"use client";
import { useState } from "react";
import Link from "next/link";
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
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/password/forgot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
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
          <Typography variant="h4">Recuperar senha</Typography>
          <Typography color="text.secondary" sx={{ my: 2 }}>
            Informe seu e-mail para receber um link temporário.
          </Typography>
          {message && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {message}
            </Alert>
          )}
          <Stack component="form" spacing={2} onSubmit={submit}>
            <TextField
              label="E-mail"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" variant="contained">
              Enviar instruções
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
