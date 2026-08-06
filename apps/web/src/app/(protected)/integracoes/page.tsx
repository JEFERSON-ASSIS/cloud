"use client";

import { useEffect, useState } from "react";
import { CloudDone, Storage, Settings } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useSearchParams } from "next/navigation";
import { formatCuiabaDateTime } from "@/lib/date";

type Connection = {
  status: string;
  accountEmail?: string;
  lastTestedAt?: string;
  quotaUsed?: string;
  quotaLimit?: string;
} | null;

type S3Connection = {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
} | null;

export default function IntegrationsPage() {
  const query = useSearchParams();
  const [connection, setConnection] = useState<Connection>(null);
  const [s3Conn, setS3Conn] = useState<S3Connection>(null);
  const [loading, setLoading] = useState(true);
  
  // Dialogs
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [rootDialog, setRootDialog] = useState(false);
  const [rootFolderId, setRootFolderId] = useState("");

  const [s3DialogOpen, setS3DialogOpen] = useState(false);
  const [s3Provider, setS3Provider] = useState<"S3" | "MINIO" | "BACKBLAZE_B2">("S3");
  const [s3Endpoint, setS3Endpoint] = useState("");
  const [s3Region, setS3Region] = useState("us-east-1");
  const [s3Bucket, setS3Bucket] = useState("");
  const [s3AccessKey, setS3AccessKey] = useState("");
  const [s3SecretKey, setS3SecretKey] = useState("");

  const [message, setMessage] = useState(
    query.get("connected")
      ? "Google Drive conectado com sucesso."
      : query.get("error")
  );

  const load = async () => {
    setLoading(true);
    try {
      const [resDrive, resS3] = await Promise.all([
        fetch("/api/integrations/google-drive"),
        fetch("/api/integrations/s3"),
      ]);
      setConnection(resDrive.ok ? await resDrive.json() : null);
      setS3Conn(resS3.ok ? await resS3.json() : null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const test = async () => {
    setLoading(true);
    const response = await fetch("/api/integrations/google-drive", {
      method: "POST",
    });
    const body = await response.json();
    setMessage(response.ok ? "Conexão testada com sucesso." : body.error);
    await load();
  };

  const disconnect = async () => {
    if (
      !confirm(
        "Desconectar o Google Drive? Os documentos existentes ficarão indisponíveis até uma nova conexão."
      )
    )
      return;
    await fetch("/api/integrations/google-drive", { method: "DELETE" });
    setMessage("Google Drive desconectado.");
    await load();
  };

  const configureRoot = async () => {
    setLoading(true);
    const response = await fetch("/api/integrations/google-drive?folders=1");
    const body = await response.json();
    if (response.ok) {
      setFolders(body);
      setRootDialog(true);
    } else setMessage(body.error);
    setLoading(false);
  };

  const saveRoot = async () => {
    const response = await fetch("/api/integrations/google-drive", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rootFolderId }),
    });
    const body = await response.json();
    setMessage(response.ok ? "Pasta raiz atualizada." : body.error);
    if (response.ok) setRootDialog(false);
    await load();
  };

  const openS3Modal = (prov: "S3" | "MINIO" | "BACKBLAZE_B2") => {
    setS3Provider(prov);
    setS3Endpoint(prov === "MINIO" ? "http://localhost:9000" : prov === "BACKBLAZE_B2" ? "https://s3.us-west-004.backblazeb2.com" : "");
    setS3DialogOpen(true);
  };

  const saveS3 = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/s3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: s3Provider,
          endpoint: s3Endpoint,
          region: s3Region,
          bucket: s3Bucket,
          accessKeyId: s3AccessKey,
          secretAccessKey: s3SecretKey,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message || "Armazenamento configurado com sucesso!");
        setS3DialogOpen(false);
        await load();
      } else {
        setMessage(data.error || "Erro ao salvar S3.");
      }
    } catch {
      setMessage("Erro de rede.");
    } finally {
      setLoading(false);
    }
  };

  const disconnectS3 = async () => {
    if (!confirm("Deseja remover esta conexão de armazenamento?")) return;
    await fetch("/api/integrations/s3", { method: "DELETE" });
    setMessage("Conexão S3 removida.");
    await load();
  };

  const used = Number(connection?.quotaUsed ?? 0);
  const limit = Number(connection?.quotaLimit ?? 0);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Integrações
        </Typography>
        <Typography color="text.secondary">
          Conecte provedores de armazenamento em nuvem e servidores externos.
        </Typography>
      </Box>

      {message && (
        <Alert
          severity={message.toLowerCase().includes("erro") ? "error" : "success"}
          onClose={() => setMessage(null)}
        >
          {message}
        </Alert>
      )}

      {loading && <LinearProgress />}

      <Grid container spacing={2}>
        {/* Google Drive */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <CloudDone
                  color={
                    connection?.status === "CONNECTED" ? "success" : "disabled"
                  }
                />
                <Chip
                  label={
                    connection?.status === "CONNECTED"
                      ? "Conectado"
                      : "Não conectado"
                  }
                  color={
                    connection?.status === "CONNECTED" ? "success" : "default"
                  }
                />
              </Stack>
              <Typography variant="h6" sx={{ mt: 2 }}>
                Google Drive
              </Typography>
              <Typography color="text.secondary">
                {connection?.accountEmail ??
                  "Armazene documentos e backups diretamente no Google Drive."}
              </Typography>
              {connection?.lastTestedAt && (
                <Typography variant="caption">
                  Último teste: {formatCuiabaDateTime(connection.lastTestedAt)}
                </Typography>
              )}
              {limit > 0 && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, (used / limit) * 100)}
                  />
                  <Typography variant="caption">
                    {(used / 1024 / 1024 / 1024).toFixed(1)} GB de{" "}
                    {(limit / 1024 / 1024 / 1024).toFixed(1)} GB
                  </Typography>
                </Box>
              )}
            </CardContent>
            <CardActions>
              {connection?.status === "CONNECTED" ? (
                <>
                  <Button onClick={test}>Testar conexão</Button>
                  <Button onClick={configureRoot}>Configurar pasta</Button>
                  <Button color="error" onClick={disconnect}>
                    Desconectar
                  </Button>
                </>
              ) : (
                <Button
                  variant="contained"
                  href="/api/integrations/google-drive/connect"
                >
                  Conectar Google Drive
                </Button>
              )}
            </CardActions>
          </Card>
        </Grid>

        {/* Amazon S3 / MinIO / Backblaze B2 */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Storage color={s3Conn?.status === "CONNECTED" ? "success" : "disabled"} />
                <Chip
                  label={s3Conn?.status === "CONNECTED" ? "Conectado" : "Disponível"}
                  color={s3Conn?.status === "CONNECTED" ? "success" : "default"}
                />
              </Stack>
              <Typography variant="h6" sx={{ mt: 2 }}>
                AWS S3 / MinIO / Backblaze B2
              </Typography>
              <Typography color="text.secondary">
                {s3Conn ? s3Conn.name : "Conecte buckets S3, MinIO local ou Backblaze B2."}
              </Typography>
            </CardContent>
            <CardActions>
              {s3Conn?.status === "CONNECTED" ? (
                <>
                  <Button startIcon={<Settings />} onClick={() => openS3Modal("S3")}>
                    Configurar
                  </Button>
                  <Button color="error" onClick={disconnectS3}>
                    Desconectar
                  </Button>
                </>
              ) : (
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" onClick={() => openS3Modal("S3")}>
                    Conectar S3
                  </Button>
                  <Button variant="outlined" onClick={() => openS3Modal("MINIO")}>
                    MinIO
                  </Button>
                  <Button variant="outlined" onClick={() => openS3Modal("BACKBLAZE_B2")}>
                    Backblaze
                  </Button>
                </Stack>
              )}
            </CardActions>
          </Card>
        </Grid>
      </Grid>

      {/* Dialog Pasta Raiz Google Drive */}
      <Dialog open={rootDialog} onClose={() => setRootDialog(false)} fullWidth maxWidth="xs">
        <DialogTitle>Selecionar pasta raiz</DialogTitle>
        <DialogContent>
          <Select
            native
            fullWidth
            value={rootFolderId}
            onChange={(event) => setRootFolderId(String(event.target.value))}
            sx={{ mt: 1 }}
          >
            <option value="">Selecione</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </Select>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRootDialog(false)}>Cancelar</Button>
          <Button variant="contained" disabled={!rootFolderId} onClick={saveRoot}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Modal S3/MinIO */}
      <Dialog open={s3DialogOpen} onClose={() => setS3DialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Configurar {s3Provider}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nome do Bucket"
              placeholder="meu-bucket-de-backups"
              value={s3Bucket}
              onChange={(e) => setS3Bucket(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Access Key ID"
              placeholder="AKIA..."
              value={s3AccessKey}
              onChange={(e) => setS3AccessKey(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Secret Access Key"
              type="password"
              placeholder="••••••••••••••••"
              value={s3SecretKey}
              onChange={(e) => setS3SecretKey(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Endpoint Personalizado (opcional para MinIO/Backblaze)"
              placeholder="http://localhost:9000 ou https://s3.us-west-004.backblazeb2.com"
              value={s3Endpoint}
              onChange={(e) => setS3Endpoint(e.target.value)}
              fullWidth
            />
            <TextField
              label="Região (AWS)"
              placeholder="us-east-1"
              value={s3Region}
              onChange={(e) => setS3Region(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setS3DialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => void saveS3()}>
            Salvar e Testar
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
