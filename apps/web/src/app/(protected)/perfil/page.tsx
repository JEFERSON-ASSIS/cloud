"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { PersonOutlined, SaveOutlined } from "@mui/icons-material";

type Profile = { name: string; email: string };

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Erro ao carregar perfil.");
        setProfile(result);
        setName(result.name);
      })
      .catch((loadError: unknown) =>
        setError(loadError instanceof Error ? loadError.message : "Erro ao carregar perfil."),
      );
  }, []);

  const save = async () => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, currentPassword, newPassword, confirmPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro ao atualizar perfil.");
      setProfile({ name: result.name, email: result.email });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(
        result.passwordChanged
          ? "Perfil e senha atualizados com segurança."
          : "Perfil atualizado com sucesso.",
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao atualizar perfil.");
    } finally {
      setBusy(false);
    }
  };

  if (!profile && !error) {
    return (
      <Stack sx={{ alignItems: "center", py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 760 }}>
      <Box>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <PersonOutlined color="primary" />
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Meu perfil
          </Typography>
        </Stack>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Atualize seus dados pessoais e sua senha de acesso.
        </Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess("")}>{success}</Alert>}

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
        <Stack spacing={2.5}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Dados pessoais</Typography>
          <TextField
            label="Nome"
            value={name}
            onChange={(event) => setName(event.target.value)}
            fullWidth
            required
            slotProps={{ htmlInput: { maxLength: 120 } }}
          />
          <TextField label="E-mail" value={profile?.email ?? ""} fullWidth disabled />

          <Divider />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Alterar senha</Typography>
            <Typography variant="body2" color="text.secondary">
              Deixe os campos abaixo vazios se quiser alterar somente o nome.
            </Typography>
          </Box>
          <TextField
            label="Senha atual"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            fullWidth
            autoComplete="current-password"
          />
          <TextField
            label="Nova senha"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            helperText="Use pelo menos 8 caracteres."
            fullWidth
            autoComplete="new-password"
          />
          <TextField
            label="Confirmar nova senha"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            fullWidth
            autoComplete="new-password"
          />
          <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
            <Button
              variant="contained"
              startIcon={<SaveOutlined />}
              disabled={busy || name.trim().length < 2}
              onClick={() => void save()}
            >
              {busy ? "Salvando…" : "Salvar alterações"}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
