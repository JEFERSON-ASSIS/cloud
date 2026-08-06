"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add,
  Delete,
  Edit,
  Schedule,
  PlayArrow,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
} from "@mui/icons-material";
import { PageHeader } from "@/components/PageHeader/PageHeader";

type BackupSource = { id: string; name: string; type: string };

type Schedule = {
  id: string;
  name: string;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  time: string;
  timezone: string;
  retentionDaily: number;
  retentionWeekly: number;
  retentionMonthly: number;
  active: boolean;
  sources: BackupSource[];
  lastRun: { status: string; startedAt: string | null; completedAt: string | null } | null;
};

const FREQ_LABEL: Record<string, string> = { DAILY: "Diário", WEEKLY: "Semanal", MONTHLY: "Mensal" };
const TYPE_LABEL: Record<string, string> = { MYSQL: "MySQL", POSTGRESQL: "PostgreSQL", DOCKER_VOLUME: "Docker Volume", DIRECTORY: "Diretório" };

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; color: "success" | "error" | "warning" | "default" }> = {
    COMPLETED: { label: "Concluído", color: "success" },
    FAILED: { label: "Falhou", color: "error" },
    RUNNING: { label: "Rodando", color: "warning" },
    PENDING: { label: "Pendente", color: "default" },
  };
  const cfg = map[status] ?? { label: status, color: "default" };
  return <Chip label={cfg.label} color={cfg.color} size="small" />;
}

function nextRunDescription(schedule: Schedule): string {
  const [h, m] = schedule.time.split(":").map(Number);
  const now = new Date();
  const next = new Date();
  next.setHours(h ?? 2, m ?? 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  if (schedule.frequency === "WEEKLY") {
    // next Monday
    const diff = (8 - next.getDay()) % 7 || 7;
    next.setDate(next.getDate() + diff - 1);
  } else if (schedule.frequency === "MONTHLY") {
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
  }
  return next.toLocaleString("pt-BR", { timeZone: schedule.timezone, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AgendamentosPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [sources, setSources] = useState<BackupSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("DAILY");
  const [time, setTime] = useState("02:00");
  const [timezone] = useState("America/Cuiaba");
  const [retentionDaily, setRetentionDaily] = useState(7);
  const [retentionWeekly, setRetentionWeekly] = useState(4);
  const [retentionMonthly, setRetentionMonthly] = useState(6);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedules");
      if (res.ok) setSchedules(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSources = useCallback(async () => {
    const res = await fetch("/api/backup-sources");
    if (res.ok) setSources(await res.json());
  }, []);

  useEffect(() => {
    void fetchSchedules();
    void fetchSources();
  }, [fetchSchedules, fetchSources]);

  function openCreate() {
    setEditing(null);
    setName("");
    setFrequency("DAILY");
    setTime("02:00");
    setRetentionDaily(7);
    setRetentionWeekly(4);
    setRetentionMonthly(6);
    setSelectedSources([]);
    setError("");
    setDialogOpen(true);
  }

  function openEdit(s: Schedule) {
    setEditing(s);
    setName(s.name);
    setFrequency(s.frequency);
    setTime(s.time);
    setRetentionDaily(s.retentionDaily);
    setRetentionWeekly(s.retentionWeekly);
    setRetentionMonthly(s.retentionMonthly);
    setSelectedSources(s.sources.map((src) => src.id));
    setError("");
    setDialogOpen(true);
  }

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      const payload = { name, frequency, time, timezone, retentionDaily, retentionWeekly, retentionMonthly, sourceIds: selectedSources };
      const res = editing
        ? await fetch(`/api/schedules/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro ao salvar."); return; }
      setSuccess(editing ? "Agendamento atualizado!" : "Agendamento criado!");
      setDialogOpen(false);
      void fetchSchedules();
      setTimeout(() => setSuccess(""), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Deseja excluir este agendamento?")) return;
    await fetch(`/api/schedules/${id}`, { method: "DELETE" });
    void fetchSchedules();
  }

  async function handleToggle(s: Schedule) {
    await fetch(`/api/schedules/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !s.active }),
    });
    void fetchSchedules();
  }

  function toggleSource(id: string) {
    setSelectedSources((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  return (
    <Box>
      <PageHeader
        title="Agendamentos"
        description="Gerencie rotinas automáticas de backup."
        action={
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
            Novo Agendamento
          </Button>
        }
      />

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {loading ? (
        <LinearProgress />
      ) : schedules.length === 0 ? (
        <Card variant="outlined">
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <Schedule sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
            <Typography variant="h6" color="text.secondary">Nenhum agendamento configurado</Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
              Crie agendamentos para automatizar seus backups
            </Typography>
            <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
              Criar Primeiro Agendamento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {schedules.map((s) => (
            <Grid size={{ xs: 12, md: 6 }} key={s.id}>
              <Card variant="outlined" sx={{ borderLeft: s.active ? "3px solid" : undefined, borderLeftColor: s.active ? "primary.main" : undefined }}>
                <CardContent>
                  <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3 }}>{s.name}</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                        <Chip label={FREQ_LABEL[s.frequency]} size="small" color="primary" variant="outlined" />
                        <Chip label={s.time} size="small" icon={<Schedule fontSize="small" />} />
                        {!s.active && <Chip label="Inativo" size="small" color="default" />}
                      </Stack>
                    </Box>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title={s.active ? "Desativar" : "Ativar"}>
                        <Switch size="small" checked={s.active} onChange={() => void handleToggle(s)} />
                      </Tooltip>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => openEdit(s)}><Edit fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir">
                        <IconButton size="small" color="error" onClick={() => void handleDelete(s.id)}><Delete fontSize="small" /></IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>

                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                    Origens: {s.sources.map((src) => `${src.name} (${TYPE_LABEL[src.type] ?? src.type})`).join(", ")}
                  </Typography>

                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                    Retenção: {s.retentionDaily}d / {s.retentionWeekly}s / {s.retentionMonthly}m &nbsp;|&nbsp;
                    Timezone: {s.timezone}
                  </Typography>

                  {s.active && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                      Próxima execução estimada: {nextRunDescription(s)}
                    </Typography>
                  )}

                  {s.lastRun && (
                    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
                      <Stack direction="row" sx={{ alignItems: "center" }} spacing={1}>
                        {s.lastRun.status === "COMPLETED" ? <CheckCircle color="success" fontSize="small" /> : s.lastRun.status === "FAILED" ? <ErrorIcon color="error" fontSize="small" /> : <Warning color="warning" fontSize="small" />}
                        <Typography variant="caption">
                          Último: <StatusChip status={s.lastRun.status} /> em {s.lastRun.startedAt ? new Date(s.lastRun.startedAt).toLocaleString("pt-BR") : "—"}
                        </Typography>
                      </Stack>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Editar Agendamento" : "Novo Agendamento"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField label="Nome" fullWidth value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Backup Noturno MySQL" />

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>Frequência</Typography>
              <Select fullWidth value={frequency} onChange={(e) => setFrequency(e.target.value as "DAILY" | "WEEKLY" | "MONTHLY")}>
                <MenuItem value="DAILY">Diário</MenuItem>
                <MenuItem value="WEEKLY">Semanal (às Segundas)</MenuItem>
                <MenuItem value="MONTHLY">Mensal (dia 1)</MenuItem>
              </Select>
            </Box>

            <TextField label="Horário (HH:MM)" fullWidth value={time} onChange={(e) => setTime(e.target.value)} placeholder="02:00" helperText="Timezone: America/Cuiaba" />

            <Grid container spacing={2}>
              <Grid size={{ xs: 4 }}>
                <TextField label="Reter Diários" type="number" fullWidth value={retentionDaily} onChange={(e) => setRetentionDaily(Number(e.target.value))} slotProps={{ htmlInput: { min: 1, max: 365 } }} />
              </Grid>
              <Grid size={{ xs: 4 }}>
                <TextField label="Reter Semanais" type="number" fullWidth value={retentionWeekly} onChange={(e) => setRetentionWeekly(Number(e.target.value))} slotProps={{ htmlInput: { min: 0, max: 52 } }} />
              </Grid>
              <Grid size={{ xs: 4 }}>
                <TextField label="Reter Mensais" type="number" fullWidth value={retentionMonthly} onChange={(e) => setRetentionMonthly(Number(e.target.value))} slotProps={{ htmlInput: { min: 0, max: 60 } }} />
              </Grid>
            </Grid>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Origens de Backup</Typography>
              {sources.length === 0 ? (
                <Alert severity="info">Cadastre origens de backup primeiro em &quot;Backups&quot;.</Alert>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {sources.map((src) => (
                    <FormControlLabel
                      key={src.id}
                      control={<Switch size="small" checked={selectedSources.includes(src.id)} onChange={() => toggleSource(src.id)} />}
                      label={`${src.name} (${TYPE_LABEL[src.type] ?? src.type})`}
                    />
                  ))}
                </Box>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => void handleSave()} disabled={saving || !name || !time || selectedSources.length === 0}>
            {saving ? <CircularProgress size={20} /> : editing ? "Salvar" : "Criar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
