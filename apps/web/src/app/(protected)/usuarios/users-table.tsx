"use client";
import { useState } from "react";
import type { GridColDef } from "@mui/x-data-grid";
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
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add,
  Block,
  CheckCircle,
  Close,
  Delete,
  Edit,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import { formatCuiabaDateTime } from "@/lib/date";
import { DataTable } from "@/components/DataTable/DataTable";
import { StatusChip } from "@/components/StatusChip/StatusChip";
import { PageHeader } from "@/components/PageHeader/PageHeader";

type Row = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
};

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

const ROLE_OPTIONS = ["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATOR", "VIEWER"] as const;
const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Administrador",
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  OPERATOR: "Operador",
  VIEWER: "Visualizador",
};

export function UsersTable({ rows: initialRows }: { rows: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [editingUser, setEditingUser] = useState<Row | null>(null);
  const [deletingUser, setDeletingUser] = useState<Row | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Form states (Create / Edit)
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<string>("VIEWER");
  const [formPassword, setFormPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; severity: "success" | "error" } | null>(null);

  const showToast = (msg: string, severity: "success" | "error" = "success") =>
    setToast({ msg, severity });

  const openCreate = () => {
    setFormName("");
    setFormEmail("");
    setFormRole("VIEWER");
    setFormPassword("");
    setShowPassword(false);
    setCreateDialogOpen(true);
  };

  const handleSaveCreate = async () => {
    if (!formName.trim() || !formEmail.trim() || !formPassword.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          password: formPassword,
          role: formRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar usuário.");

      const newRow: Row = {
        id: data.id,
        name: data.name,
        email: data.email,
        role: formRole,
        status: "ACTIVE",
        lastLoginAt: null,
      };

      setRows((prev) => [newRow, ...prev]);
      setCreateDialogOpen(false);
      showToast("Usuário cadastrado com sucesso!");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erro ao criar usuário.", "error");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (user: Row) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormPassword("");
    setShowPassword(false);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      const body: Record<string, string> = {
        name: formName,
        email: formEmail,
        role: formRole,
      };
      if (formPassword) body.password = formPassword;

      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar.");

      setRows((prev) =>
        prev.map((r) =>
          r.id === editingUser.id
            ? { ...r, name: formName, email: formEmail, role: formRole }
            : r
        )
      );
      setEditingUser(null);
      showToast("Usuário atualizado com sucesso!");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (user: Row) => {
    const newStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar status.");
      setRows((prev) =>
        prev.map((r) => (r.id === user.id ? { ...r, status: newStatus } : r))
      );
      showToast(newStatus === "ACTIVE" ? "Usuário ativado!" : "Usuário inativado!");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erro.", "error");
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${deletingUser.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao excluir.");
      setRows((prev) => prev.filter((r) => r.id !== deletingUser.id));
      setDeletingUser(null);
      showToast("Usuário removido com sucesso!");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erro.", "error");
    } finally {
      setSaving(false);
    }
  };

  const columns: GridColDef<Row>[] = [
    {
      field: "name",
      headerName: "Nome",
      flex: 1,
      minWidth: 180,
      renderCell: ({ row }) => (
        <Stack direction="row" sx={{ alignItems: "center", gap: 1.5, py: 1 }}>
          <Avatar sx={{ width: 32, height: 32, fontSize: 12, bgcolor: "primary.main", fontWeight: 700 }}>
            {getInitials(row.name)}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={600}>{row.name}</Typography>
            <Typography variant="caption" color="text.secondary">{row.email}</Typography>
          </Box>
        </Stack>
      ),
    },
    {
      field: "role",
      headerName: "Perfil",
      width: 160,
      renderCell: ({ value }) => (
        <Chip
          label={ROLE_LABELS[String(value)] ?? String(value)}
          size="small"
          variant="outlined"
          color={value === "SUPER_ADMIN" || value === "ADMIN" ? "primary" : "default"}
          sx={{ fontWeight: 600, fontSize: 11 }}
        />
      ),
    },
    {
      field: "status",
      headerName: "Status",
      width: 110,
      renderCell: ({ value }) => <StatusChip status={String(value)} />,
    },
    {
      field: "lastLoginAt",
      headerName: "Último acesso",
      width: 175,
      valueFormatter: (value) => (value ? formatCuiabaDateTime(String(value)) : "Nunca"),
    },
    {
      field: "actions",
      headerName: "Ações",
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
          <Tooltip title="Editar usuário">
            <IconButton size="small" onClick={() => openEdit(row)}>
              <Edit sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={row.status === "ACTIVE" ? "Inativar usuário" : "Ativar usuário"}>
            <IconButton
              size="small"
              color={row.status === "ACTIVE" ? "warning" : "success"}
              onClick={() => void handleToggleStatus(row)}
            >
              {row.status === "ACTIVE"
                ? <Block sx={{ fontSize: 16 }} />
                : <CheckCircle sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Excluir usuário">
            <IconButton size="small" color="error" onClick={() => setDeletingUser(row)}>
              <Delete sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Usuários"
        description="Gerencie acessos e perfis da empresa atual."
        action={
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={openCreate}
            sx={{ borderRadius: 2, px: 3, fontWeight: 600 }}
          >
            Novo Usuário
          </Button>
        }
      />

      <DataTable rows={rows} columns={columns} getRowHeight={() => "auto"} />

      {/* Create Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h6" fontWeight={700}>Cadastrar Novo Usuário</Typography>
              <Typography variant="caption" color="text.secondary">Preencha os dados do novo usuário da empresa</Typography>
            </Box>
            <IconButton size="small" onClick={() => setCreateDialogOpen(false)}><Close fontSize="small" /></IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Nome completo"
              fullWidth
              autoFocus
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Ex: João da Silva"
            />
            <TextField
              label="E-mail"
              fullWidth
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="joao@empresa.com.br"
            />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                Perfil de acesso
              </Typography>
              <Select
                fullWidth
                size="small"
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <MenuItem key={r} value={r}>{ROLE_LABELS[r]}</MenuItem>
                ))}
              </Select>
            </Box>
            <TextField
              label="Senha de acesso"
              fullWidth
              type={showPassword ? "text" : "password"}
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              helperText="Mínimo de 12 caracteres"
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setShowPassword((prev) => !prev)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setCreateDialogOpen(false)} sx={{ borderRadius: 2 }}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!formName.trim() || !formEmail.trim() || formPassword.length < 12 || saving}
            onClick={() => void handleSaveCreate()}
            sx={{ borderRadius: 2, px: 3 }}
          >
            {saving ? "Cadastrando..." : "Cadastrar Usuário"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h6" fontWeight={700}>Editar Usuário</Typography>
              <Typography variant="caption" color="text.secondary">{editingUser?.email}</Typography>
            </Box>
            <IconButton size="small" onClick={() => setEditingUser(null)}><Close fontSize="small" /></IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Nome completo"
              fullWidth
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
            <TextField
              label="E-mail"
              fullWidth
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
            />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                Perfil de acesso
              </Typography>
              <Select
                fullWidth
                size="small"
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <MenuItem key={r} value={r}>{ROLE_LABELS[r]}</MenuItem>
                ))}
              </Select>
            </Box>
            <TextField
              label="Nova senha (deixe em branco para manter)"
              fullWidth
              type={showPassword ? "text" : "password"}
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              helperText="Mínimo de 12 caracteres"
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setShowPassword((prev) => !prev)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setEditingUser(null)} sx={{ borderRadius: 2 }}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!formName.trim() || !formEmail.trim() || saving}
            onClick={() => void handleSaveEdit()}
            sx={{ borderRadius: 2, px: 3 }}
          >
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog
        open={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
            <Avatar sx={{ bgcolor: "error.main", width: 40, height: 40 }}>
              <Delete />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Excluir Usuário</Typography>
              <Typography variant="caption" color="text.secondary">Esta ação não pode ser desfeita</Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Você está prestes a remover <strong>{deletingUser?.name}</strong> ({deletingUser?.email}) da organização.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setDeletingUser(null)} sx={{ borderRadius: 2 }}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            disabled={saving}
            onClick={() => void handleDelete()}
            sx={{ borderRadius: 2, px: 3 }}
          >
            {saving ? "Removendo..." : "Sim, excluir"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast */}
      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={toast?.severity ?? "success"} onClose={() => setToast(null)} sx={{ borderRadius: 2 }}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
