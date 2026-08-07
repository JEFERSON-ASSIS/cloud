"use client";
import { useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add,
  Close,
  Delete,
  Edit,
  FolderOpen,
  GroupAdd,
  People,
  PersonRemove,
  Storage,
  AccountTree,
  AdminPanelSettings,
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

type OrgUserOption = {
  id: string;
  name: string;
  email: string;
};

const ROLE_CONFIG: Record<string, { label: string; color: "error" | "warning" | "info" | "success" | "default" }> = {
  ADMIN: { label: "Admin", color: "error" },
  EDITOR: { label: "Editor", color: "warning" },
  VIEWER_DOWNLOAD: { label: "Visualizador+", color: "info" },
  VIEWER_ONLY: { label: "Somente leitura", color: "default" },
  NO_ACCESS: { label: "Sem acesso", color: "default" },
};

const CARD_GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
  "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)",
];

function formatBytes(bytes: number): string {
  if (bytes >= 1099511627776) return (bytes / 1099511627776).toFixed(1) + " TB";
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + " GB";
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + " MB";
  return bytes + " B";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function SectorCardSkeleton() {
  return (
    <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
      <Skeleton variant="rectangular" height={100} />
      <Box sx={{ p: 2.5 }}>
        <Skeleton width="60%" height={28} sx={{ mb: 0.5 }} />
        <Skeleton width="40%" height={20} />
        <Box sx={{ mt: 2 }}>
          <Skeleton height={8} sx={{ borderRadius: 4 }} />
        </Box>
      </Box>
      <Divider />
      <Box sx={{ px: 2.5, py: 1.5 }}>
        <Stack direction="row" spacing={2}>
          <Skeleton width={70} height={20} />
          <Skeleton width={70} height={20} />
        </Stack>
      </Box>
    </Paper>
  );
}

export default function SecretariasPage() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [sectorDialog, setSectorDialog] = useState(false);
  const [memberDialog, setMemberDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [sectorName, setSectorName] = useState("");
  const [sectorQuota, setSectorQuota] = useState(1);

  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUserOption[]>([]);
  const [selectedUserOption, setSelectedUserOption] = useState<OrgUserOption | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberRole, setMemberRole] = useState("VIEWER_DOWNLOAD");
  const [savingMember, setSavingMember] = useState(false);
  const [memberModalError, setMemberModalError] = useState("");

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
    void loadSectors(true);
  }, []);

  const handleSaveSector = async () => {
    setError("");
    const bytes = BigInt(sectorQuota) * BigInt(1073741824);
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
        setSuccess(editingSector ? "Secretaria atualizada com sucesso!" : "Secretaria criada com sucesso!");
        setSectorDialog(false);
        setSectorName("");
        setSectorQuota(1);
        setEditingSector(null);
        await loadSectors(false);
      } else {
        setError(data.error || "Erro ao salvar secretaria.");
      }
    } catch {
      setError("Erro de rede.");
    }
  };

  const handleDeleteSector = async () => {
    if (!deletingId) return;
    try {
      const res = await fetch(`/api/sectors/${deletingId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Secretaria excluída com sucesso!");
        setDeleteDialog(false);
        setDeletingId(null);
        await loadSectors(false);
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
    setSelectedUserOption(null);
    setMemberRole("VIEWER_DOWNLOAD");
    setMemberModalError("");
    setMembersLoading(true);
    try {
      const [resMembers, resUsers] = await Promise.all([
        fetch(`/api/sectors/${sector.id}/users`),
        fetch(`/api/users`),
      ]);
      const dataMembers = await resMembers.json();
      const dataUsers = await resUsers.json();
      
      if (resMembers.ok) setMembers(dataMembers);
      else setMemberModalError(dataMembers.error || "Erro ao carregar membros.");

      if (resUsers.ok && Array.isArray(dataUsers)) {
        setOrgUsers(dataUsers);
      }
    } catch {
      setMemberModalError("Erro de rede ao carregar membros.");
    } finally {
      setMembersLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedSector || !selectedUserOption) return;
    setSavingMember(true);
    setMemberModalError("");
    try {
      const res = await fetch(`/api/sectors/${selectedSector.id}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: selectedUserOption.email, role: memberRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Membro adicionado com sucesso!");
        setSelectedUserOption(null);
        const res2 = await fetch(`/api/sectors/${selectedSector.id}/users`);
        const data2 = await res2.json();
        if (res2.ok) setMembers(data2);
        await loadSectors(false);
      } else {
        setMemberModalError(data.error || "Erro ao adicionar membro.");
      }
    } catch {
      setMemberModalError("Erro de rede ao adicionar membro.");
    } finally {
      setSavingMember(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedSector) return;
    setMemberModalError("");
    try {
      const res = await fetch(`/api/sectors/${selectedSector.id}/users?userId=${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Membro removido com sucesso.");
        setMembers(members.filter((m) => m.userId !== userId));
        await loadSectors(false);
      } else {
        setMemberModalError(data.error || "Erro ao remover membro.");
      }
    } catch {
      setMemberModalError("Erro de rede ao remover membro.");
    }
  };

  const deletingSector = sectors.find((s) => s.id === deletingId);

  const totalDocs = sectors.reduce((a, s) => a + s._count.documents, 0);
  const totalUsers = sectors.reduce((a, s) => a + s._count.users, 0);
  const totalQuota = sectors.reduce((a, s) => a + Number(s.quotaLimit), 0);

  // Filtrar usuários da organização que ainda não são membros desta secretaria
  const availableUsers = orgUsers.filter(
    (u) => !members.some((m) => m.userId === u.id)
  );

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Secretarias"
        description="Gerencie divisões administrativas, cotas de armazenamento e membros por secretaria."
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
            sx={{ borderRadius: 2, px: 3, fontWeight: 600 }}
          >
            Nova Secretaria
          </Button>
        }
      />

      {error && <Alert severity="error" onClose={() => setError("")} sx={{ borderRadius: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess("")} sx={{ borderRadius: 2 }}>{success}</Alert>}

      {/* Summary Stats */}
      {!loading && sectors.length > 0 && (
        <Grid container spacing={2}>
          {[
            { label: "Total de Secretarias", value: sectors.length, icon: <AccountTree />, color: "#667eea" },
            { label: "Total de Membros", value: totalUsers, icon: <People />, color: "#f5576c" },
            { label: "Total de Documentos", value: totalDocs, icon: <FolderOpen />, color: "#43e97b" },
            { label: "Cota Total Alocada", value: formatBytes(totalQuota), icon: <Storage />, color: "#4facfe" },
          ].map((stat) => (
            <Grid size={{ xs: 6, md: 3 }} key={stat.label}>
              <Paper
                elevation={0}
                sx={{
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                  p: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: stat.color + "20",
                    color: stat.color,
                    width: 44,
                    height: 44,
                  }}
                >
                  {stat.icon}
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1 }}>
                    {stat.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stat.label}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Cards */}
      {loading ? (
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={i}>
              <SectorCardSkeleton />
            </Grid>
          ))}
        </Grid>
      ) : sectors.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            border: "2px dashed",
            borderColor: "divider",
            p: { xs: 6, md: 10 },
            textAlign: "center",
          }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #667eea20, #764ba220)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 2,
            }}
          >
            <AccountTree sx={{ fontSize: 36, color: "primary.main" }} />
          </Box>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Nenhuma secretaria cadastrada
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 360, mx: "auto" }}>
            Organize seus usuários e documentos criando a primeira secretaria do sistema.
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => { setEditingSector(null); setSectorName(""); setSectorQuota(1); setSectorDialog(true); }}
            sx={{ borderRadius: 2, px: 4 }}
          >
            Criar Primeira Secretaria
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {sectors.map((sector, idx) => {
            const quotaBytes = Number(sector.quotaLimit);
            const gradient = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
            const initials = getInitials(sector.name);

            return (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={sector.id}>
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: 3,
                    border: "1px solid",
                    borderColor: "divider",
                    overflow: "hidden",
                    transition: "all 0.25s ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
                      borderColor: "transparent",
                    },
                  }}
                >
                  {/* Gradient Header */}
                  <Box
                    sx={{
                      background: gradient,
                      p: 3,
                      position: "relative",
                      minHeight: 110,
                    }}
                  >
                    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                      <Avatar
                        sx={{
                          bgcolor: "rgba(255,255,255,0.25)",
                          color: "white",
                          width: 48,
                          height: 48,
                          fontWeight: 800,
                          fontSize: 18,
                          backdropFilter: "blur(10px)",
                        }}
                      >
                        {initials}
                      </Avatar>
                      <Chip
                        label={`${sector._count.users} membro${sector._count.users !== 1 ? "s" : ""}`}
                        size="small"
                        sx={{
                          bgcolor: "rgba(255,255,255,0.25)",
                          color: "white",
                          fontWeight: 600,
                          fontSize: 11,
                          backdropFilter: "blur(10px)",
                        }}
                      />
                    </Stack>
                    <Typography
                      variant="h6"
                      fontWeight={800}
                      sx={{ color: "white", mt: 1.5, textShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
                      noWrap
                      title={sector.name}
                    >
                      {sector.name}
                    </Typography>
                  </Box>

                  {/* Body */}
                  <Box sx={{ p: 2.5 }}>
                    {/* Quota */}
                    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Storage sx={{ fontSize: 12 }} /> Cota alocada
                      </Typography>
                      <Typography variant="caption" fontWeight={700} color="primary">
                        {formatBytes(quotaBytes)}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={0}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: "action.hover",
                        "& .MuiLinearProgress-bar": { borderRadius: 3 },
                      }}
                    />

                    {/* Stats row */}
                    <Stack
                      direction="row"
                      sx={{
                        justifyContent: "space-between",
                        mt: 2,
                        pt: 2,
                        borderTop: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Stack spacing={0.25} sx={{ alignItems: "center" }}>
                        <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1 }}>
                          {sector._count.documents}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                          <FolderOpen sx={{ fontSize: 10 }} /> Docs
                        </Typography>
                      </Stack>
                      <Divider orientation="vertical" flexItem />
                      <Stack spacing={0.25} sx={{ alignItems: "center" }}>
                        <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1 }}>
                          {sector._count.users}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                          <People sx={{ fontSize: 10 }} /> Membros
                        </Typography>
                      </Stack>
                      <Divider orientation="vertical" flexItem />
                      <Stack spacing={0.25} sx={{ alignItems: "center" }}>
                        <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1 }}>
                          {sector._count.storageSpaces}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                          <Storage sx={{ fontSize: 10 }} /> Espaços
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>

                  <Divider />

                  {/* Action bar */}
                  <Stack
                    direction="row"
                    sx={{ px: 2, py: 1, justifyContent: "space-between", alignItems: "center" }}
                  >
                    <Button
                      size="small"
                      startIcon={<GroupAdd fontSize="small" />}
                      onClick={() => void handleOpenMembers(sector)}
                      sx={{ borderRadius: 1.5, fontSize: 12, color: "primary.main" }}
                    >
                      Membros
                    </Button>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Editar">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingSector(sector);
                            setSectorName(sector.name);
                            setSectorQuota(Number(sector.quotaLimit) / 1073741824);
                            setSectorDialog(true);
                          }}
                          sx={{ color: "text.secondary" }}
                        >
                          <Edit sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir">
                        <IconButton
                          size="small"
                          onClick={() => { setDeletingId(sector.id); setDeleteDialog(true); }}
                          sx={{ color: "error.main" }}
                        >
                          <Delete sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Dialog: Criar/Editar Secretaria */}
      <Dialog
        open={sectorDialog}
        onClose={() => setSectorDialog(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                {editingSector ? "Editar Secretaria" : "Nova Secretaria"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {editingSector ? "Altere os dados da secretaria" : "Preencha os dados para criar"}
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setSectorDialog(false)}><Close fontSize="small" /></IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Nome da Secretaria"
              fullWidth
              autoFocus
              value={sectorName}
              onChange={(e) => setSectorName(e.target.value)}
              placeholder="Ex: Secretaria de Educação"
            />
            <TextField
              label="Cota de Armazenamento"
              type="number"
              fullWidth
              value={sectorQuota}
              onChange={(e) => setSectorQuota(Number(e.target.value))}
              inputProps={{ min: 1 }}
              slotProps={{
                input: { endAdornment: <InputAdornment position="end">GB</InputAdornment> }
              }}
              helperText={sectorQuota > 0 ? `Equivale a ${formatBytes(sectorQuota * 1073741824)}` : "Informe um valor válido"}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setSectorDialog(false)} sx={{ borderRadius: 2 }}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!sectorName.trim() || sectorQuota <= 0}
            onClick={() => void handleSaveSector()}
            sx={{ borderRadius: 2, px: 3 }}
          >
            {editingSector ? "Salvar Alterações" : "Criar Secretaria"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Confirmar Exclusão */}
      <Dialog
        open={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
            <Avatar sx={{ bgcolor: "error.lighter", color: "error.main", width: 40, height: 40 }}>
              <Delete />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Excluir Secretaria</Typography>
              <Typography variant="caption" color="text.secondary">Esta ação não pode ser desfeita</Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Você está prestes a excluir a secretaria{" "}
            <strong style={{ color: "inherit" }}>{deletingSector?.name}</strong>. Todos os dados associados serão removidos permanentemente.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setDeleteDialog(false)} sx={{ borderRadius: 2 }}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={() => void handleDeleteSector()} sx={{ borderRadius: 2, px: 3 }}>
            Sim, excluir
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Gerenciar Membros */}
      <Dialog
        open={memberDialog}
        onClose={() => setMemberDialog(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
          <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Avatar sx={{ bgcolor: "primary.main", width: 44, height: 44, fontWeight: 700, fontSize: 16 }}>
                {getInitials(selectedSector?.name ?? "S")}
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight={700}>Membros da Secretaria</Typography>
                <Typography variant="caption" color="text.secondary">{selectedSector?.name}</Typography>
              </Box>
            </Stack>
            <IconButton size="small" onClick={() => setMemberDialog(false)}><Close fontSize="small" /></IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {/* Add member form */}
          <Box sx={{ p: 3, bgcolor: "action.hover", borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2, display: "flex", alignItems: "center", gap: 0.75 }}>
              <GroupAdd fontSize="small" color="primary" /> Adicionar Membro à Secretaria
            </Typography>

            {memberModalError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setMemberModalError("")}>
                {memberModalError}
              </Alert>
            )}

            <Grid container spacing={2} sx={{ alignItems: "center" }}>
              <Grid size={{ xs: 12, sm: 6, md: 7 }}>
                <Select
                  size="small"
                  fullWidth
                  displayEmpty
                  value={selectedUserOption?.id ?? ""}
                  onChange={(e) => {
                    const u = availableUsers.find((user) => user.id === e.target.value);
                    setSelectedUserOption(u ?? null);
                  }}
                >
                  <MenuItem value="" disabled>
                    <em>Selecione um usuário cadastrado...</em>
                  </MenuItem>
                  {availableUsers.map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </MenuItem>
                  ))}
                </Select>
              </Grid>

              <Grid size={{ xs: 12, sm: 3, md: 3 }}>
                <Select
                  size="small"
                  fullWidth
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                >
                  <MenuItem value="ADMIN">Admin</MenuItem>
                  <MenuItem value="EDITOR">Editor</MenuItem>
                  <MenuItem value="VIEWER_DOWNLOAD">Visualizador+</MenuItem>
                  <MenuItem value="VIEWER_ONLY">Somente leitura</MenuItem>
                  <MenuItem value="NO_ACCESS">Sem acesso</MenuItem>
                </Select>
              </Grid>

              <Grid size={{ xs: 12, sm: 3, md: 2 }}>
                <Button
                  variant="contained"
                  fullWidth
                  disabled={!selectedUserOption || savingMember}
                  onClick={() => void handleAddMember()}
                  sx={{ borderRadius: 2, height: 40, fontWeight: 600 }}
                >
                  {savingMember ? "..." : "Adicionar"}
                </Button>
              </Grid>
            </Grid>
          </Box>

          {/* Members list */}
          <Box sx={{ p: 3 }}>
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <People fontSize="small" color="action" /> Membros Atuais
              </Typography>
              {members.length > 0 && (
                <Chip label={members.length} size="small" color="primary" variant="outlined" />
              )}
            </Stack>

            {membersLoading ? (
              <Stack spacing={1.5}>
                {[1, 2, 3].map((i) => (
                  <Stack key={i} direction="row" spacing={2} sx={{ alignItems: "center", p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                    <Skeleton variant="circular" width={36} height={36} />
                    <Box flex={1}>
                      <Skeleton width="45%" height={18} />
                      <Skeleton width="65%" height={14} />
                    </Box>
                    <Skeleton width={80} height={24} sx={{ borderRadius: 4 }} />
                  </Stack>
                ))}
              </Stack>
            ) : members.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 5 }}>
                <People sx={{ fontSize: 44, color: "text.disabled", mb: 1 }} />
                <Typography variant="body2" color="text.disabled">
                  Nenhum membro associado ainda.
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={1.5}>
                {members.map((member) => {
                  const roleInfo = ROLE_CONFIG[member.role] ?? { label: member.role, color: "default" as const };
                  const isAdmin = member.role === "ADMIN";
                  return (
                    <Grid size={{ xs: 12, sm: 6 }} key={member.id}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: 2.5,
                          border: "1px solid",
                          borderColor: isAdmin ? "primary.light" : "divider",
                          bgcolor: isAdmin ? "primary.50" : "transparent",
                          transition: "all 0.15s",
                          "&:hover": { borderColor: "primary.main", boxShadow: 1 },
                        }}
                      >
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                          <Avatar sx={{ width: 40, height: 40, fontSize: 14, fontWeight: 700, bgcolor: isAdmin ? "primary.main" : "grey.400" }}>
                            {getInitials(member.user.name || "?")}
                          </Avatar>
                          <Box flex={1} minWidth={0}>
                            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                              <Typography variant="body2" fontWeight={600} noWrap>
                                {member.user.name}
                              </Typography>
                              {isAdmin && <AdminPanelSettings sx={{ fontSize: 14, color: "primary.main" }} />}
                            </Stack>
                            <Typography variant="caption" color="text.secondary" noWrap display="block">
                              {member.user.email}
                            </Typography>
                          </Box>
                          <Chip
                            label={roleInfo.label}
                            size="small"
                            color={roleInfo.color}
                            variant="outlined"
                            sx={{ flexShrink: 0, fontWeight: 600, fontSize: 11 }}
                          />
                          <Tooltip title="Remover membro">
                            <IconButton size="small" color="error" onClick={() => void handleRemoveMember(member.userId)}>
                              <PersonRemove sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: "1px solid", borderColor: "divider" }}>
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
            {members.length} membro{members.length !== 1 ? "s" : ""} nesta secretaria
          </Typography>
          <Button onClick={() => setMemberDialog(false)} sx={{ borderRadius: 2, px: 3 }}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
