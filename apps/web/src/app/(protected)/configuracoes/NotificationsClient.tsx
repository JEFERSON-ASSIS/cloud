"use client";

import { useState, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { Notifications, Add, Delete, Send, Email, Lock } from "@mui/icons-material";

interface NotificationItem {
  id: string;
  channel: string;
  active: boolean;
  events: string[];
  config: Record<string, any>;
  createdAt: string;
}

export function NotificationsClient() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; severity: "success" | "error" } | null>(null);

  // Form State
  const [channel, setChannel] = useState("DISCORD");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  
  // SMTP Fields
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(true);

  const [eventSuccess, setEventSuccess] = useState(true);
  const [eventFailed, setEventFailed] = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchNotifications();
  }, []);

  const handleSave = async () => {
    setMsg(null);
    const events = [];
    if (eventSuccess) events.push("SUCCESS");
    if (eventFailed) events.push("FAILED");

    let config: Record<string, any> = {};
    if (channel === "EMAIL") {
      config = {
        toEmail: email,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass,
        smtpSecure,
      };
    } else {
      config = { url };
    }

    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          config,
          events,
          active: true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        setMsg({ text: errData.error || "Erro ao salvar", severity: "error" });
        return;
      }

      setMsg({ text: "Notificação salva com sucesso!", severity: "success" });
      setOpenModal(false);
      setUrl("");
      setEmail("");
      setSmtpHost("");
      setSmtpUser("");
      setSmtpPass("");
      void fetchNotifications();
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Erro interno", severity: "error" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente remover esta notificação?")) return;
    try {
      const res = await fetch(`/api/notifications?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setMsg({ text: "Notificação removida", severity: "success" });
        void fetchNotifications();
      }
    } catch {
      // ignore
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/notifications/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ text: data.error || "Erro ao enviar teste", severity: "error" });
      } else {
        setMsg({ text: `Notificação enviada com sucesso para ${data.sentCount} canal(is)!`, severity: "success" });
      }
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Erro técnico", severity: "error" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card variant="outlined">
      <CardHeader
        avatar={<Notifications color="primary" />}
        title={<Typography variant="h6">Notificações e Alertas</Typography>}
        subheader="Configure Webhooks (Discord, Slack, HTTP) ou E-mail SMTP para ser avisado sobre o estado dos backups."
        action={
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              startIcon={<Send />}
              onClick={() => void handleTest()}
              disabled={testing || items.length === 0}
            >
              {testing ? "Enviando..." : "Testar Alerta"}
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<Add />}
              onClick={() => setOpenModal(true)}
            >
              Novo Canal
            </Button>
          </Stack>
        }
      />
      <CardContent>
        {msg && (
          <Alert severity={msg.severity} sx={{ mb: 2 }} onClose={() => setMsg(null)}>
            {msg.text}
          </Alert>
        )}

        {loading ? (
          <Typography color="text.secondary">Carregando canais...</Typography>
        ) : items.length === 0 ? (
          <Alert severity="info">
            Nenhum canal de notificação configurado ainda. Clique em "Novo Canal" para cadastrar um Discord Webhook ou E-mail com Servidor SMTP.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {items.map((item) => (
              <Grid size={{ xs: 12, md: 6 }} key={item.id}>
                <Card variant="outlined" sx={{ p: 2, background: "rgba(255,255,255,0.02)" }}>
                  <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Chip
                        label={item.channel}
                        color={
                          item.channel === "DISCORD"
                            ? "primary"
                            : item.channel === "SLACK"
                            ? "warning"
                            : item.channel === "EMAIL"
                            ? "info"
                            : "default"
                        }
                        size="small"
                      />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {item.config.url
                          ? item.config.url.substring(0, 35) + "..."
                          : item.config.toEmail || "Configuração Ativa"}
                      </Typography>
                    </Stack>
                    <IconButton size="small" color="error" onClick={() => void handleDelete(item.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Stack>

                  {item.channel === "EMAIL" && item.config.smtpHost && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                      SMTP: {item.config.smtpHost}:{item.config.smtpPort || "587"} ({item.config.smtpUser})
                    </Typography>
                  )}

                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                    {item.events.includes("SUCCESS") && <Chip label="Sucesso ✅" size="small" color="success" variant="outlined" />}
                    {item.events.includes("FAILED") && <Chip label="Falhas ❌" size="small" color="error" variant="outlined" />}
                  </Stack>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </CardContent>

      <Dialog open={openModal} onClose={() => setOpenModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Configurar Notificação de Backup</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Canal de Comunicação</InputLabel>
              <Select value={channel} label="Canal de Comunicação" onChange={(e) => setChannel(e.target.value)}>
                <MenuItem value="DISCORD">Discord Webhook</MenuItem>
                <MenuItem value="SLACK">Slack Webhook</MenuItem>
                <MenuItem value="WEBHOOK">Webhook HTTP Genérico</MenuItem>
                <MenuItem value="EMAIL">E-mail (SMTP Customizado)</MenuItem>
              </Select>
            </FormControl>

            {channel === "EMAIL" ? (
              <>
                <TextField
                  label="E-mail de Destino"
                  placeholder="admin@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                  required
                />

                <Typography variant="subtitle2" sx={{ mt: 1, fontWeight: 700, display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Email fontSize="small" color="primary" /> Configurações do Servidor SMTP
                </Typography>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 8 }}>
                    <TextField
                      label="Servidor SMTP (Host)"
                      placeholder="smtp.gmail.com ou smtp.empresa.com"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      fullWidth
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <TextField
                      label="Porta"
                      placeholder="587"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      fullWidth
                      required
                    />
                  </Grid>
                </Grid>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      label="Usuário SMTP"
                      placeholder="usuario@empresa.com"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      fullWidth
                    />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      label="Senha SMTP"
                      type="password"
                      placeholder="••••••••"
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      fullWidth
                    />
                  </Grid>
                </Grid>

                <FormControlLabel
                  control={<Switch checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} />}
                  label="Usar conexão segura (SSL/TLS / STARTTLS)"
                />
              </>
            ) : (
              <TextField
                label="URL do Webhook"
                placeholder="https://discord.com/api/webhooks/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                fullWidth
              />
            )}

            <Typography variant="subtitle2" sx={{ mt: 1 }}>
              Eventos a Notificar:
            </Typography>
            <FormGroup row>
              <FormControlLabel
                control={<Switch checked={eventSuccess} onChange={(e) => setEventSuccess(e.target.checked)} />}
                label="Sucesso do Backup"
              />
              <FormControlLabel
                control={<Switch checked={eventFailed} onChange={(e) => setEventFailed(e.target.checked)} />}
                label="Falhas / Erros"
              />
            </FormGroup>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenModal(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => void handleSave()}>
            Salvar Canal
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
