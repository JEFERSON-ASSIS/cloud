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
  TextField,
  Typography,
} from "@mui/material";
import {
  Add,
  Delete,
  Edit,
  Dns,
  Wifi,
} from "@mui/icons-material";
import { PageHeader } from "@/components/PageHeader/PageHeader";

type Server = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authenticationType: "PASSWORD" | "KEY";
  status: string;
  createdAt: string;
};

export default function ServidoresPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Diálogos
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);

  // Estados do formulário
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("");
  const [authType, setAuthType] = useState<"PASSWORD" | "KEY">("PASSWORD");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");

  const [testing, setTesting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const loadServers = async (showProgress = true) => {
    if (showProgress) setLoading(true);
    try {
      const res = await fetch("/api/servers");
      const data = await res.json();
      if (res.ok) setServers(data);
      else setError(data.error || "Erro ao carregar servidores.");
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadServers(false);
  }, []);

  const handleOpenCreate = () => {
    setEditingServer(null);
    setName("");
    setHost("");
    setPort(22);
    setUsername("");
    setAuthType("PASSWORD");
    setPassword("");
    setPrivateKey("");
    setError("");
    setDialogOpen(true);
  };

  const handleOpenEdit = (server: Server) => {
    setEditingServer(server);
    setName(server.name);
    setHost(server.host);
    setPort(server.port);
    setUsername(server.username);
    setAuthType(server.authenticationType);
    setPassword("");
    setPrivateKey("");
    setError("");
    setDialogOpen(true);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/servers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId: editingServer?.id,
          host,
          port,
          username,
          authenticationType: authType,
          password: password || undefined,
          privateKey: privateKey || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Conexão SSH estabelecida com sucesso!");
      } else {
        setError(data.error || "Falha na conexão SSH.");
      }
    } catch {
      setError("Erro de rede ao testar conexão.");
    } finally {
      setTesting(false);
    }
  };

  const handleTestExistingConnection = async (serverId: string) => {
    setTestingId(serverId);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/servers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Conexão SSH ativa e saudável!");
      } else {
        setError(`Falha no servidor: ${data.error || "Desconhecido"}`);
      }
    } catch {
      setError("Erro ao se conectar com o servidor.");
    } finally {
      setTestingId(null);
    }
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");
    try {
      const url = editingServer ? `/api/servers/${editingServer.id}` : "/api/servers";
      const method = editingServer ? "PATCH" : "POST";
      const payload: Record<string, unknown> = {
        name,
        host,
        port,
        username,
        authenticationType: authType,
      };
      if (password) payload.password = password;
      if (privateKey) payload.privateKey = privateKey;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(editingServer ? "Servidor atualizado." : "Servidor cadastrado.");
        setDialogOpen(false);
        await loadServers();
      } else {
        setError(data.error || "Erro ao salvar servidor.");
      }
    } catch {
      setError("Erro de rede.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este servidor?")) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/servers/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Servidor removido.");
        await loadServers();
      } else {
        setError(data.error || "Erro ao remover servidor.");
      }
    } catch {
      setError("Erro de rede.");
    }
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Servidores"
        description="Gerenciamento de servidores remotos para a realização de dumps de banco de dados e backup de arquivos via SSH."
        action={
          <Button variant="contained" startIcon={<Add />} onClick={handleOpenCreate}>
            Novo Servidor
          </Button>
        }
      />

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
      ) : (
        <Grid container spacing={3}>
          {servers.map((server) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={server.id}>
              <Card variant="outlined">
                <CardContent sx={{ pb: 1 }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}>
                    <Dns color="primary" />
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        {server.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {server.host}:{server.port}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      Usuário: <strong>{server.username}</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Autenticação: <strong>{server.authenticationType === "PASSWORD" ? "Senha" : "Chave Privada"}</strong>
                    </Typography>
                  </Stack>
                </CardContent>
                <CardActions sx={{ justifyContent: "flex-end", px: 2, pb: 2 }}>
                  <IconButton
                    size="small"
                    color="primary"
                    disabled={testingId !== null}
                    onClick={() => void handleTestExistingConnection(server.id)}
                    title="Testar Conexão SSH"
                  >
                    {testingId === server.id ? (
                      <CircularProgress size={20} />
                    ) : (
                      <Wifi fontSize="small" />
                    )}
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleOpenEdit(server)}
                    title="Editar"
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => void handleDelete(server.id)}
                    title="Remover"
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
          {servers.length === 0 && (
            <Grid size={{ xs: 12 }}>
              <Alert severity="info" variant="outlined">
                Nenhum servidor SSH configurado. Clique em &quot;Novo Servidor&quot; para adicionar.
              </Alert>
            </Grid>
          )}
        </Grid>
      )}

      {/* Dialogo de Criação/Edição */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editingServer ? "Editar Servidor" : "Cadastrar Servidor"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nome do Servidor"
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Servidor de Produção"
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Host / IP"
                fullWidth
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.10"
              />
              <TextField
                label="Porta SSH"
                type="number"
                sx={{ width: 120 }}
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
              />
            </Stack>
            <TextField
              label="Usuário SSH"
              fullWidth
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="root"
            />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                Tipo de Autenticação
              </Typography>
              <Select
                fullWidth
                value={authType}
                onChange={(e) => setAuthType(e.target.value as "PASSWORD" | "KEY")}
              >
                <MenuItem value="PASSWORD">Senha</MenuItem>
                <MenuItem value="KEY">Chave Privada</MenuItem>
              </Select>
            </Box>

            {authType === "PASSWORD" ? (
              <TextField
                label="Senha SSH"
                type="password"
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editingServer ? "Preencha para alterar a senha salva" : "Senha do servidor"}
              />
            ) : (
              <TextField
                label="Chave Privada SSH"
                multiline
                rows={4}
                fullWidth
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder={editingServer ? "Cole uma nova chave privada para alterar" : "ssh-rsa AAAAB3NzaC1yc2E..."}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
          <Button
            variant="outlined"
            onClick={() => void handleTestConnection()}
            disabled={testing || !host.trim() || !username.trim()}
          >
            {testing ? <CircularProgress size={20} /> : "Testar Conexão"}
          </Button>
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              variant="contained"
              onClick={() => void handleSave()}
              disabled={!name.trim() || !host.trim() || !username.trim()}
            >
              Salvar
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
