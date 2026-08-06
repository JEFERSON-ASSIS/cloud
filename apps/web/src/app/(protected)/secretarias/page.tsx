"use client";
import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  Add,
  Delete,
  Edit,
  People,
  Storage,
} from "@mui/icons-material";
import { PageHeader } from "@/components/PageHeader/PageHeader";

type Sector = {
  id: string;
  name: string;
  quotaLimit: string;
  _count: {
    users: number;
    storageSpaces: number;
    documents: number;
  };
};

type Member = {
  id: string;
  userId: string;
  role: string;
  user: {
    name: string;
    email: string;
  };
};

export default function SecretariasPage() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Diálogos
  const [sectorDialog, setSectorDialog] = useState(false);
  const [memberDialog, setMemberDialog] = useState(false);

  // Estados dos formulários
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [sectorName, setSectorName] = useState("");
  const [sectorQuota, setSectorQuota] = useState(1); // Em GB

  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("VIEWER_DOWNLOAD");

  const loadSectors = async (showProgress = true) => {
    if (showProgress) setLoading(true);
    try {
      const res = await fetch("/api/sectors");
      const data = await res.json();
      if (res.ok) setSectors(data);
      else setError(data.error || "Falha ao carregar secretarias.");
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSectors(false);
  }, []);

  const handleSaveSector = async () => {
    setError("");
    const bytes = BigInt(sectorQuota) * BigInt(1073741824); // GB para Bytes
    try {
      const url = editingSector ? `/api/sectors/${editingSector.id}` : "/api/sectors";
      const method = editingSector ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: sectorName, quotaLimit: bytes.toString() }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(editingSector ? "Secretaria atualizada." : "Secretaria criada.");
        setSectorDialog(false);
        setSectorName("");
        setSectorQuota(1);
        setEditingSector(null);
        await loadSectors();
      } else {
        setError(data.error || "Erro ao salvar secretaria.");
      }
    } catch {
      setError("Erro de rede.");
    }
  };

  const handleDeleteSector = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta secretaria?")) return;
    setError("");
    try {
      const res = await fetch(`/api/sectors/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Secretaria excluída.");
        await loadSectors();
      } else {
        setError(data.error || "Erro ao excluir secretaria.");
      }
    } catch {
      setError("Erro de rede.");
    }
  };

  const handleOpenMembers = async (sector: Sector) => {
    setSelectedSector(sector);
    setMemberDialog(true);
    setMemberEmail("");
    setMemberRole("VIEWER_DOWNLOAD");
    setError("");
    try {
      const res = await fetch(`/api/sectors/${sector.id}/users`);
      const data = await res.json();
      if (res.ok) setMembers(data);
      else setError(data.error || "Erro ao carregar membros.");
    } catch {
      setError("Erro de rede.");
    }
  };

  const handleAddMember = async () => {
    if (!selectedSector) return;
    setError("");
    try {
      const res = await fetch(`/api/sectors/${selectedSector.id}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: memberEmail, role: memberRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Membro adicionado com sucesso.");
        setMemberEmail("");
        // Recarregar lista de membros
        const res2 = await fetch(`/api/sectors/${selectedSector.id}/users`);
        const data2 = await res2.json();
        if (res2.ok) setMembers(data2);
      } else {
        setError(data.error || "Erro ao adicionar membro.");
      }
    } catch {
      setError("Erro de rede.");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedSector) return;
    setError("");
    try {
      const res = await fetch(`/api/sectors/${selectedSector.id}/users?userId=${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Membro removido.");
        setMembers(members.filter((m) => m.userId !== userId));
      } else {
        setError(data.error || "Erro ao remover membro.");
      }
    } catch {
      setError("Erro de rede.");
    }
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Secretarias"
        description="Gestão de divisões administrativas, limites de cota e membros por secretaria."
        action={
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              setEditingSector(null);
              setSectorName("");
              setSectorQuota(1);
              setSectorDialog(true);
            }}
          >
            Nova Secretaria
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
          {sectors.map((sector) => {
            const quotaGB = (Number(sector.quotaLimit) / 1024 / 1024 / 1024).toFixed(1);
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={sector.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                      {sector.name}
                    </Typography>
                    <Stack spacing={1.5} sx={{ mt: 2 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Storage color="action" fontSize="small" />
                        <Typography variant="body2" color="text.secondary">
                          Quota Limite: <strong>{quotaGB} GB</strong>
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <People color="action" fontSize="small" />
                        <Typography variant="body2" color="text.secondary">
                          Membros associados: <strong>{sector._count.users}</strong>
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        Documentos gerenciados: {sector._count.documents}
                      </Typography>
                    </Stack>
                  </CardContent>
                  <CardActions sx={{ justifyContent: "flex-end", px: 2, pb: 2 }}>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleOpenMembers(sector)}
                      title="Gerenciar membros"
                    >
                      <People fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditingSector(sector);
                        setSectorName(sector.name);
                        setSectorQuota(Number(sector.quotaLimit) / 1024 / 1024 / 1024);
                        setSectorDialog(true);
                      }}
                      title="Editar"
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => void handleDeleteSector(sector.id)}
                      title="Excluir"
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Dialogo de Criação/Edição */}
      <Dialog
        open={sectorDialog}
        onClose={() => setSectorDialog(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{editingSector ? "Editar Secretaria" : "Nova Secretaria"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nome da Secretaria"
              fullWidth
              value={sectorName}
              onChange={(e) => setSectorName(e.target.value)}
            />
            <TextField
              label="Quota de Armazenamento (GB)"
              type="number"
              fullWidth
              value={sectorQuota}
              onChange={(e) => setSectorQuota(Number(e.target.value))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSectorDialog(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!sectorName.trim() || sectorQuota <= 0}
            onClick={() => void handleSaveSector()}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialogo de Membros */}
      <Dialog
        open={memberDialog}
        onClose={() => setMemberDialog(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Membros de: {selectedSector?.name}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            {/* Formulário para Adicionar Membro */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>
                Adicionar Membro à Secretaria
              </Typography>
              <Grid container spacing={2} sx={{ alignItems: "center" }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="E-mail do usuário"
                    size="small"
                    fullWidth
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Select
                    size="small"
                    fullWidth
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                  >
                    <MenuItem value="ADMIN">ADMIN</MenuItem>
                    <MenuItem value="EDITOR">EDITOR</MenuItem>
                    <MenuItem value="VIEWER_DOWNLOAD">VIEWER_DOWNLOAD</MenuItem>
                    <MenuItem value="VIEWER_ONLY">VIEWER_ONLY</MenuItem>
                    <MenuItem value="NO_ACCESS">NO_ACCESS</MenuItem>
                  </Select>
                </Grid>
                <Grid size={{ xs: 12, sm: 2 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    disabled={!memberEmail.trim()}
                    onClick={() => void handleAddMember()}
                  >
                    Add
                  </Button>
                </Grid>
              </Grid>
            </Paper>

            {/* Lista de Membros */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                Membros Atuais
              </Typography>
              <List>
                {members.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Nenhum membro associado.
                  </Typography>
                ) : (
                  members.map((member) => (
                    <ListItem key={member.id} divider>
                      <ListItemText
                        primary={member.user.name}
                        secondary={`${member.user.email} • Papel: ${member.role}`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          color="error"
                          onClick={() => void handleRemoveMember(member.userId)}
                        >
                          <Delete />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))
                )}
              </List>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMemberDialog(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
