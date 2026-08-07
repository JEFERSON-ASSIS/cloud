"use client";
import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  Add,
  Delete,
  Edit,
  PlayArrow,
  Storage,
  Article,
  CheckCircle,
  Error as ErrorIcon,
  SettingsBackupRestore,
} from "@mui/icons-material";

import { PageHeader } from "@/components/PageHeader/PageHeader";

type Server = { id: string; name: string; host: string };
type Sector = { id: string; name: string };

type BackupSource = {
  id: string;
  name: string;
  type: "MYSQL" | "POSTGRESQL" | "DOCKER_VOLUME" | "DIRECTORY";
  sectorId?: string | null;
  sectorName?: string;
  serverId: string | null;
  serverName: string;
  active: boolean;
  createdAt: string;
  config?: Record<string, unknown>;
};

type BackupRun = {
  id: string;
  status: string;
  progress: number;
  currentStep: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  sectorName?: string;
  source: { name: string; type: string };
};

type BackupLog = {
  id: string;
  level: string;
  message: string;
  createdAt: string;
};

export default function BackupsPage() {
  const [tab, setTab] = useState(0);
  const [servers, setServers] = useState<Server[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [sources, setSources] = useState<BackupSource[]>([]);
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Dialogs
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<BackupSource | null>(null);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<BackupRun | null>(null);
  const [runLogs, setRunLogs] = useState<BackupLog[]>([]);
  const [pollingRunId, setPollingRunId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [type, setType] = useState<"MYSQL" | "POSTGRESQL" | "DOCKER_VOLUME" | "DIRECTORY">("MYSQL");
  const [sectorId, setSectorId] = useState<string>("");
  const [serverId, setServerId] = useState<string>("");
  
  // Configs
  const [host, setHost] = useState("");
  const [port, setPort] = useState<number | string>(3306);
  const [dbName, setDbName] = useState("");
  const [dbUser, setDbUser] = useState("");
  const [dbPassword, setDbPassword] = useState("");
  const [dockerName, setDockerName] = useState(""); // container/service name
  const [path, setPath] = useState(""); // for DIRECTORY or DOCKER_VOLUME path
  const [volumeName, setVolumeName] = useState("");

  const loadData = async (showProgress = true) => {
    if (showProgress) setLoading(true);
    try {
      const [resServers, resSectors, resSources, resRuns] = await Promise.all([
        fetch("/api/servers"),
        fetch("/api/sectors"),
        fetch("/api/backup-sources"),
        fetch("/api/backup-runs"),
      ]);
      const dataServers = await resServers.json();
      const dataSectors = await resSectors.json();
      const dataSources = await resSources.json();
      const dataRuns = await resRuns.json();

      if (resServers.ok) setServers(dataServers);
      if (resSectors.ok && Array.isArray(dataSectors)) {
        setSectors(dataSectors);
        if (dataSectors.length > 0 && !sectorId) {
          setSectorId(dataSectors[0].id);
        }
      }
      if (resSources.ok) setSources(dataSources);
      if (resRuns.ok) setRuns(dataRuns);
    } catch {
      setError("Erro ao carregar os dados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData(false);
  }, []);

  // Polling para acompanhar execução de backup em tempo real
  useEffect(() => {
    if (!pollingRunId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/backup-runs/${pollingRunId}`);
        const data = await res.json();
        if (res.ok) {
          // Atualizar o selectedRun se estiver visualizando o log dele
          if (selectedRun?.id === pollingRunId) {
            setSelectedRun(data);
            setRunLogs(data.logs);
          }
          // Se finalizou, parar polling e atualizar a lista
          if (data.status === "COMPLETED" || data.status === "FAILED") {
            setPollingRunId(null);
            void loadData(false);
          }
        }
      } catch {
        setPollingRunId(null);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [pollingRunId, selectedRun]);

  const handleTypeChange = (newType: "MYSQL" | "POSTGRESQL" | "DOCKER_VOLUME" | "DIRECTORY") => {
    setType(newType);
    if (newType === "MYSQL") {
      if (!host) setHost("mysql");
      setPort(3306);
    } else if (newType === "POSTGRESQL") {
      if (!host) setHost("postgres");
      setPort(5432);
    }
  };

  const handleOpenCreate = () => {
    setEditingSource(null);
    setName("");
    setType("MYSQL");
    setHost("mysql");
    setPort(3306);
    if (sectors.length > 0 && sectors[0]) setSectorId(sectors[0].id);
    setServerId("");
    setDbName("");
    setDbUser("");
    setDbPassword("");
    setDockerName("");
    setPath("");
    setVolumeName("");
    setError("");
    setSourceDialogOpen(true);
  };

  const handleOpenEdit = async (source: BackupSource) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/backup-sources/${source.id}`);
      const data = await res.json();
      if (res.ok) {
        setEditingSource(data);
        setName(data.name);
        setType(data.type);
        setSectorId(data.sectorId || (sectors[0]?.id ?? ""));
        setServerId(data.serverId || "");
        
        const conf = data.config || {};
        setHost(conf.host || (data.type === "POSTGRESQL" ? "postgres" : "mysql"));
        setPort(conf.port || (data.type === "POSTGRESQL" ? 5432 : 3306));
        setDbName(conf.dbName || "");
        setDbUser(conf.dbUser || "");
        setDbPassword(conf.dbPassword || "");
        setDockerName(conf.dockerName || "");
        setPath(conf.path || "");
        setVolumeName(conf.volumeName || "");
        
        setSourceDialogOpen(true);
      } else {
        setError("Erro ao carregar detalhes da origem.");
      }
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");
    try {
      const config: Record<string, unknown> = {};
      if (type === "MYSQL" || type === "POSTGRESQL") {
        config.host = host;
        config.port = Number(port);
        config.dbName = dbName;
        config.dbUser = dbUser;
        if (dbPassword) config.dbPassword = dbPassword;
        if (dockerName) config.dockerName = dockerName;
      } else if (type === "DIRECTORY") {
        config.path = path;
      } else if (type === "DOCKER_VOLUME") {
        config.volumeName = volumeName;
      }

      const payload = {
        name,
        type,
        sectorId: sectorId || undefined,
        serverId: serverId || null,
        config,
      };

      const url = editingSource ? `/api/backup-sources/${editingSource.id}` : "/api/backup-sources";
      const method = editingSource ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSuccess(editingSource ? "Origem de backup atualizada." : "Origem de backup criada.");
        setSourceDialogOpen(false);
        await loadData();
      } else {
        const data = await res.json();
        setError(data.error || "Erro ao salvar.");
      }
    } catch {
      setError("Erro de rede.");
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover esta origem de backup?")) return;
    setError("");
    try {
      const res = await fetch(`/api/backup-sources/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSuccess("Origem removida.");
        await loadData();
      } else {
        const data = await res.json();
        setError(data.error || "Erro ao remover.");
      }
    } catch {
      setError("Erro de rede.");
    }
  };

  const handleTriggerBackup = async (id: string) => {
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/backup-sources/${id}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Backup enfileirado com sucesso!");
        // Acompanhar o log do backup disparado imediatamente
        setSelectedRun(data);
        setRunLogs([]);
        setLogDialogOpen(true);
        setPollingRunId(data.id);
      } else {
        setError(data.error || "Erro ao disparar backup.");
      }
    } catch {
      setError("Erro de rede.");
    }
  };

  const handleRestore = async (runId: string) => {
    if (!confirm("Atenção: Deseja realmente RESTAURAR este backup no servidor/banco de destino? Dados existentes poderão ser sobrescritos.")) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/backups/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupRunId: runId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || "Restauração iniciada com sucesso!");
        await loadData();
      } else {
        setError(data.error || "Erro ao iniciar restauração.");
      }
    } catch {
      setError("Erro ao conectar à API de restauração.");
    }
  };

  const handleOpenLogs = async (run: BackupRun) => {

    setSelectedRun(run);
    setLogDialogOpen(true);
    setRunLogs([]);
    if (run.status === "PENDING" || run.status === "RUNNING" || run.status.startsWith("COMPRESSING") || run.status === "UPLOADING") {
      setPollingRunId(run.id);
    }
    try {
      const res = await fetch(`/api/backup-runs/${run.id}`);
      const data = await res.json();
      if (res.ok) {
        setRunLogs(data.logs);
      }
    } catch {
      setError("Erro de rede ao carregar logs.");
    }
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Backups"
        description="Histórico, monitoramento e disparo manual de backups de bancos de dados MySQL/PostgreSQL e volumes de arquivos."
        action={
          <Button variant="contained" startIcon={<Add />} onClick={handleOpenCreate}>
            Nova Origem
          </Button>
        }
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="standard" color="primary">
        <Tab label="Origens de Backup" />
        <Tab label="Histórico de Execução" />
      </Tabs>

      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {loading ? (
        <LinearProgress />
      ) : tab === 0 ? (
        /* Origens de Backup */
        <Grid container spacing={3}>
          {sources.map((source) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={source.id}>
              <Card variant="outlined">
                <CardContent sx={{ pb: 1 }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}>
                    <Storage color="primary" />
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        {source.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Tipo: <strong>{source.type}</strong> • Servidor: <strong>{source.serverName}</strong>
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
                <CardActions sx={{ justifyContent: "flex-end", px: 2, pb: 2 }}>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<PlayArrow />}
                    onClick={() => void handleTriggerBackup(source.id)}
                  >
                    Backup Agora
                  </Button>
                  <IconButton size="small" onClick={() => void handleOpenEdit(source)} title="Editar">
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => void handleDeleteSource(source.id)} title="Remover">
                    <Delete fontSize="small" />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
          {sources.length === 0 && (
            <Grid size={{ xs: 12 }}>
              <Alert severity="info" variant="outlined">
                Nenhuma origem de backup cadastrada. Clique em &quot;Nova Origem&quot; para começar.
              </Alert>
            </Grid>
          )}
        </Grid>
      ) : (
        /* Histórico de Execuções */
        <Grid container spacing={2}>
          {runs.map((run) => {
            const date = new Date(run.startedAt).toLocaleString("pt-BR", { timeZone: "America/Cuiaba" });
            const isFinished = run.status === "COMPLETED" || run.status === "FAILED";
            return (
              <Grid size={{ xs: 12 }} key={run.id}>
                <Card variant="outlined">
                  <Box sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
                    <Box>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                        {run.status === "COMPLETED" ? (
                          <CheckCircle color="success" />
                        ) : run.status === "FAILED" ? (
                          <ErrorIcon color="error" />
                        ) : (
                          <CircularProgress size={24} />
                        )}
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {run.source.name} ({run.source.type})
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Iniciado em: {date}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                    <Box sx={{ minWidth: 150 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Status: {run.status} {run.progress}%
                      </Typography>
                      {!isFinished && (
                        <LinearProgress variant="determinate" value={run.progress} sx={{ mt: 0.5, height: 6, borderRadius: 3 }} />
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {run.currentStep || "Enfileirado"}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      {run.status === "COMPLETED" && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          startIcon={<SettingsBackupRestore />}
                          onClick={() => void handleRestore(run.id)}
                        >
                          Restaurar
                        </Button>
                      )}
                      <Button
                        size="small"
                        startIcon={<Article />}
                        onClick={() => void handleOpenLogs(run)}
                      >
                        Logs
                      </Button>
                    </Stack>

                  </Box>
                </Card>
              </Grid>
            );
          })}
          {runs.length === 0 && (
            <Grid size={{ xs: 12 }}>
              <Alert severity="info" variant="outlined">
                Nenhuma execução registrada no histórico.
              </Alert>
            </Grid>
          )}
        </Grid>
      )}

      {/* Dialogo de Criação/Edição de Origem */}
      <Dialog open={sourceDialogOpen} onClose={() => setSourceDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editingSource ? "Editar Origem de Backup" : "Nova Origem de Backup"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nome da Origem"
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Banco MySQL de Produção"
            />

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                Secretaria *
              </Typography>
              <Select
                fullWidth
                value={sectorId}
                onChange={(e) => setSectorId(e.target.value)}
                disabled={!!editingSource}
              >
                {sectors.map((s) => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </Select>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                Tipo
              </Typography>
              <Select
                fullWidth
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as "MYSQL" | "POSTGRESQL" | "DOCKER_VOLUME" | "DIRECTORY")}
                disabled={!!editingSource}
              >
                <MenuItem value="MYSQL">MySQL Database</MenuItem>
                <MenuItem value="POSTGRESQL">PostgreSQL Database</MenuItem>
                <MenuItem value="DIRECTORY">Diretório / Pasta do Servidor</MenuItem>
                <MenuItem value="DOCKER_VOLUME">Volume Docker</MenuItem>
              </Select>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                Servidor Remoto (SSH)
              </Typography>
              <Select
                fullWidth
                value={serverId}
                onChange={(e) => setServerId(e.target.value)}
                displayEmpty
              >
                <MenuItem value="">Local (executar no host principal)</MenuItem>
                {servers.map((s) => (
                  <MenuItem key={s.id} value={s.id}>{s.name} ({s.host})</MenuItem>
                ))}
              </Select>
            </Box>

            {/* Configs baseadas em tipo */}
            {(type === "MYSQL" || type === "POSTGRESQL") && (
              <>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 8 }}>
                    <TextField
                      label="Host *"
                      fullWidth
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder={type === "MYSQL" ? "mysql" : "postgres"}
                      helperText="Hostname ou DNS acessível pelo Worker. Ex.: mysql, postgres, postgres_psf."
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <TextField
                      label="Porta *"
                      type="number"
                      fullWidth
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      required
                    />
                  </Grid>
                </Grid>
                <TextField
                  label="Nome do Banco de Dados"
                  fullWidth
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  placeholder="Nome do schema"
                />
                <TextField
                  label="Usuário do Banco"
                  fullWidth
                  value={dbUser}
                  onChange={(e) => setDbUser(e.target.value)}
                  placeholder="root / postgres"
                />
                <TextField
                  label="Senha do Banco (opcional)"
                  type="password"
                  fullWidth
                  value={dbPassword}
                  onChange={(e) => setDbPassword(e.target.value)}
                  placeholder={editingSource ? "Preencha para alterar a senha salva" : "Senha"}
                />
                <TextField
                  label="Nome do Serviço / Contêiner Docker (opcional)"
                  fullWidth
                  value={dockerName}
                  onChange={(e) => setDockerName(e.target.value)}
                  placeholder="ex: mysql_db (para descobrir container atual)"
                />
              </>
            )}

            {type === "DIRECTORY" && (
              <TextField
                label="Caminho Completo do Diretório"
                fullWidth
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/var/www/uploads"
              />
            )}

            {type === "DOCKER_VOLUME" && (
              <TextField
                label="Nome do Volume Docker"
                fullWidth
                value={volumeName}
                onChange={(e) => setVolumeName(e.target.value)}
                placeholder="ex: uploads_volume"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSourceDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => void handleSave()} disabled={!name.trim()}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialogo de Logs e Detalhes da Execução */}
      <Dialog open={logDialogOpen} onClose={() => { setLogDialogOpen(false); setPollingRunId(null); }} fullWidth maxWidth="sm">
        <DialogTitle>
          Execução de Backup: {selectedRun?.source.name}
        </DialogTitle>
        <DialogContent dividers sx={{ height: "450px", display: "flex", flexDirection: "column", gap: 2 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Status Atual: {selectedRun?.status} ({selectedRun?.progress}%)
            </Typography>
            <LinearProgress variant="determinate" value={selectedRun?.progress ?? 0} sx={{ height: 8, borderRadius: 4, mt: 1 }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              Passo: {selectedRun?.currentStep || "Processando"}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, backgroundColor: "#1e1e1e", color: "#d4d4d4", p: 2, borderRadius: 1, overflow: "auto", fontFamily: "monospace", fontSize: "0.85rem" }}>
            {runLogs.length === 0 ? (
              <Typography variant="caption" sx={{ color: "#888" }}>Iniciando e aguardando logs do worker...</Typography>
            ) : (
              runLogs.map((log) => {
                const isError = log.level === "ERROR" || log.level === "CRITICAL";
                const isWarning = log.level === "WARNING";
                const time = new Date(log.createdAt).toLocaleTimeString("pt-BR");
                return (
                  <div key={log.id} style={{ marginBottom: "4px" }}>
                    <span style={{ color: "#888", marginRight: "8px" }}>[{time}]</span>
                    <span style={{
                      color: isError ? "#f44336" : isWarning ? "#ff9800" : "#4caf50",
                      fontWeight: "bold",
                      marginRight: "8px"
                    }}>[{log.level}]</span>
                    <span>{log.message}</span>
                  </div>
                );
              })
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setLogDialogOpen(false); setPollingRunId(null); }}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
