"use client";
import { tenantFetch } from "@/lib/tenant-fetch";
import { useEffect, useState, useCallback } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { BugReport, Info, Warning, Error as ErrorIcon } from "@mui/icons-material";
import { PageHeader } from "@/components/PageHeader/PageHeader";

type BackupLog = {
  id: string;
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  message: string;
  createdAt: string;
  backupRun: {
    id: string;
    source: { name: string; type: string } | null;
  };
};

type LogsResponse = {
  logs: BackupLog[];
  total: number;
  limit: number;
  offset: number;
};

const LEVEL_CONFIG: Record<string, { color: "default" | "info" | "warning" | "error"; icon: React.ReactElement; bgColor: string }> = {
  DEBUG: { color: "default", icon: <BugReport fontSize="small" />, bgColor: "action.hover" },
  INFO: { color: "info", icon: <Info fontSize="small" />, bgColor: "info.light" },
  WARNING: { color: "warning", icon: <Warning fontSize="small" />, bgColor: "warning.light" },
  ERROR: { color: "error", icon: <ErrorIcon fontSize="small" />, bgColor: "error.light" },
  CRITICAL: { color: "error", icon: <ErrorIcon fontSize="small" />, bgColor: "error.light" },
};

const DEFAULT_LEVEL_CONFIG = LEVEL_CONFIG["INFO"]!;

const TYPE_LABEL: Record<string, string> = {
  MYSQL: "MySQL",
  POSTGRESQL: "PostgreSQL",
  DOCKER_VOLUME: "Docker Volume",
  DIRECTORY: "Diretório",
};

export default function LogsPage() {
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (levelFilter) params.set("level", levelFilter);
      const res = await tenantFetch(`/api/backup-logs?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [levelFilter]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const logs = data?.logs.filter((log) =>
    !search || log.message.toLowerCase().includes(search.toLowerCase()) || log.backupRun?.source?.name?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const counts = data?.logs.reduce(
    (acc, log) => { acc[log.level] = (acc[log.level] || 0) + 1; return acc; },
    {} as Record<string, number>
  ) ?? {};

  return (
    <Box>
      <PageHeader
        title="Logs de Backup"
        description="Rastreie eventos e erros operacionais sem exposição de segredos."
      />

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: "Informações", level: "INFO", color: "primary.main" },
          { label: "Avisos", level: "WARNING", color: "warning.main" },
          { label: "Erros", level: "ERROR", color: "error.main" },
        ].map(({ label, level, color }) => (
          <Grid size={{ xs: 6, sm: 4 }} key={level}>
            <Card variant="outlined" sx={{ borderLeft: "3px solid", borderLeftColor: color }}>
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color }}>{counts[level] ?? 0}</Typography>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          size="small"
          placeholder="Buscar em mensagens ou origens..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1 }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Nível</InputLabel>
          <Select label="Nível" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
            <MenuItem value="">Todos os níveis</MenuItem>
            <MenuItem value="DEBUG">Debug</MenuItem>
            <MenuItem value="INFO">Info</MenuItem>
            <MenuItem value="WARNING">Aviso</MenuItem>
            <MenuItem value="ERROR">Erro</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {loading ? (
        <LinearProgress />
      ) : logs.length === 0 ? (
        <Card variant="outlined">
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <Info sx={{ fontSize: 56, color: "text.disabled", mb: 2 }} />
            <Typography variant="h6" color="text.secondary">Nenhum log encontrado</Typography>
            <Typography variant="body2" color="text.disabled">
              Execute um backup para gerar logs de operação.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Card variant="outlined">
          <Box sx={{ fontFamily: "monospace", fontSize: 13 }}>
            {logs.map((log, i) => {
              const cfg = LEVEL_CONFIG[log.level] ?? DEFAULT_LEVEL_CONFIG;
              const date = new Date(log.createdAt).toLocaleString("pt-BR", { timeZone: "America/Cuiaba" });
              const sourceName = log.backupRun?.source?.name ?? "—";
              const sourceType = log.backupRun?.source?.type ? (TYPE_LABEL[log.backupRun.source.type] ?? log.backupRun.source.type) : "";
              return (
                <Stack
                  key={log.id}
                  direction="row"
                  sx={{
                    px: 2,
                    py: 0.8,
                    gap: 1.5,
                    alignItems: "flex-start",
                    borderBottom: i < logs.length - 1 ? "1px solid" : undefined,
                    borderColor: "divider",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Chip
                    icon={cfg.icon}
                    label={log.level}
                    color={cfg.color}
                    size="small"
                    sx={{ minWidth: 90, fontFamily: "monospace", fontSize: 11 }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ wordBreak: "break-word" }}>{log.message}</Typography>
                    <Typography variant="caption" color="text.disabled">
                      {date} &nbsp;·&nbsp; {sourceName} {sourceType ? `(${sourceType})` : ""}
                    </Typography>
                  </Box>
                </Stack>
              );
            })}
          </Box>
          {data && (
            <Box sx={{ px: 2, py: 1, borderTop: "1px solid", borderColor: "divider" }}>
              <Typography variant="caption" color="text.secondary">
                Exibindo {logs.length} de {data.total} registros
              </Typography>
            </Box>
          )}
        </Card>
      )}

      {!data && !loading && (
        <Alert severity="warning" sx={{ mt: 2 }}>Não foi possível carregar os logs. Verifique a conexão.</Alert>
      )}

      {loading && <Stack sx={{ alignItems: "center", py: 4 }}><CircularProgress /></Stack>}
    </Box>
  );
}
