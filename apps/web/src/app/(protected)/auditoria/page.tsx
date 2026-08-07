"use client";
import { useEffect, useState, useCallback } from "react";
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
  FormControlLabel,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import {
  FactCheck,
  Refresh,
  BugReport,
  CloudQueue,
  Person,
  Search,
  Code,
  CheckCircle,
  ErrorOutlined,
  Info,
} from "@mui/icons-material";
import { PageHeader } from "@/components/PageHeader/PageHeader";
import { formatCuiabaDateTime } from "@/lib/date";

type Audit = {
  id: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ip?: string;
  metadata?: any;
  createdAt: string;
  user?: { name: string; email: string };
  organization?: { name: string };
};

type OrgOption = {
  id: string;
  name: string;
};

const ACTION_COLOR_MAP: Record<string, "success" | "error" | "warning" | "info" | "default"> = {
  LOGIN: "success",
  LOGOUT: "default",
  DOCUMENT_UPLOAD: "info",
  DOCUMENT_DELETE: "error",
  FOLDER_CREATE: "info",
  FOLDER_DELETE: "error",
  GOOGLE_DRIVE_CONNECTED: "success",
  GOOGLE_DRIVE_DISCONNECTED: "error",
  SECTOR_CREATE: "success",
  SECTOR_DELETE: "error",
  ORGANIZATION_CREATE: "success",
  ORGANIZATION_DELETE: "error",
  ERROR: "error",
};

export default function AuditPage() {
  const [rows, setRows] = useState<Audit[]>([]);
  const [organizations, setOrganizations] = useState<OrgOption[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoRefresh, setAutoRefresh] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("audit-auto-refresh") === "true";
    }
    return false;
  });
  const [selectedMetadata, setSelectedMetadata] = useState<any | null>(null);

  const handleAutoRefreshToggle = (checked: boolean) => {
    setAutoRefresh(checked);
    if (typeof window !== "undefined") {
      localStorage.setItem("audit-auto-refresh", String(checked));
    }
  };

  const loadAuditLogs = useCallback(async (showProgress = true) => {
    if (showProgress) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set("action", actionFilter);
      if (userFilter) params.set("user", userFilter);
      if (selectedOrgId) params.set("organizationId", selectedOrgId);

      const [resAudit, resOrgs] = await Promise.all([
        fetch(`/api/audit?${params.toString()}`),
        fetch("/api/organizations"),
      ]);

      const dataAudit = await resAudit.json();
      const dataOrgs = await resOrgs.json();

      if (resAudit.ok) {
        setRows(dataAudit);
      } else {
        setError(dataAudit.error || "Falha ao carregar auditoria.");
      }

      if (resOrgs.ok && Array.isArray(dataOrgs)) {
        setOrganizations(dataOrgs);
      }
    } catch {
      setError("Erro de conexão com o servidor.");
    } finally {
      if (showProgress) setLoading(false);
    }
  }, [actionFilter, userFilter, selectedOrgId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAuditLogs(true);
    }, 250);
    return () => clearTimeout(timer);
  }, [loadAuditLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void loadAuditLogs(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadAuditLogs]);

  const filteredRows = rows.filter((row) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const actionText = row.action.toLowerCase();
    const userName = row.user?.name.toLowerCase() || "";
    const userEmail = row.user?.email.toLowerCase() || "";
    const orgName = row.organization?.name.toLowerCase() || "";
    const resourceType = row.resourceType?.toLowerCase() || "";
    return (
      actionText.includes(q) ||
      userName.includes(q) ||
      userEmail.includes(q) ||
      orgName.includes(q) ||
      resourceType.includes(q)
    );
  });

  const columns: GridColDef<Audit>[] = [
    {
      field: "createdAt",
      headerName: "Data / Hora",
      width: 170,
      valueFormatter: (v) => formatCuiabaDateTime(v),
    },
    {
      field: "organization",
      headerName: "Empresa / Prefeitura",
      width: 200,
      valueGetter: (_v, row) => row.organization?.name ?? "Sistema Master",
    },
    {
      field: "user",
      headerName: "Usuário",
      width: 200,
      valueGetter: (_v, row) => row.user ? `${row.user.name} (${row.user.email})` : "Sistema Automatizado",
    },
    {
      field: "action",
      headerName: "Evento / Ação",
      width: 220,
      renderCell: (p) => {
        const color = ACTION_COLOR_MAP[p.value] || "default";
        return (
          <Chip
            size="small"
            label={p.value}
            color={color}
            variant={color === "default" ? "outlined" : "filled"}
            sx={{ fontWeight: 700, fontSize: 11 }}
          />
        );
      },
    },
    { field: "resourceType", headerName: "Recurso", width: 140 },
    {
      field: "resourceId",
      headerName: "ID do Recurso / Detalhes",
      flex: 1,
      minWidth: 180,
    },
    {
      field: "metadata",
      headerName: "Console / JSON",
      width: 130,
      sortable: false,
      renderCell: (p) => {
        if (!p.row.metadata) return null;
        return (
          <Button
            size="small"
            variant="outlined"
            startIcon={<Code fontSize="small" />}
            onClick={() => setSelectedMetadata(p.row.metadata)}
            sx={{ borderRadius: 1.5, fontSize: 11, py: 0.2 }}
          >
            Ver JSON
          </Button>
        );
      },
    },
  ];

  const totalLogs = filteredRows.length;
  const errorLogs = filteredRows.filter((r) => r.action.includes("ERROR") || r.action.includes("DELETE")).length;
  const driveLogs = filteredRows.filter((r) =>
    r.action.includes("DRIVE") ||
    r.action.includes("STORAGE") ||
    r.resourceType?.includes("DRIVE") ||
    r.resourceType?.includes("FOLDER")
  ).length;

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Console & Auditoria do Sistema"
        description="Acompanhe em tempo real todos os eventos, operações de armazenamento, exceções e ações executadas no servidor."
        action={
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <FormControlLabel
              control={
                <Switch
                  checked={autoRefresh}
                  onChange={(e) => handleAutoRefreshToggle(e.target.checked)}
                  color="primary"
                  size="small"
                />
              }
              label={
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  Auto-Atualizar (5s)
                </Typography>
              }
            />
            <Button
              variant="contained"
              startIcon={<Refresh />}
              onClick={() => void loadAuditLogs(true)}
              sx={{ borderRadius: 2, px: 2.5, fontWeight: 600 }}
            >
              Atualizar Console
            </Button>
          </Stack>
        }
      />

      {error && <Alert severity="error" onClose={() => setError("")} sx={{ borderRadius: 2 }}>{error}</Alert>}

      {/* Summary Cards */}
      <Grid container spacing={2}>
        {[
          { label: "Total de Eventos Registrados", value: totalLogs, icon: <FactCheck />, color: "#667eea" },
          { label: "Alertas & Exclusões", value: errorLogs, icon: <BugReport />, color: "#f5576c" },
          { label: "Eventos de Armazenamento", value: driveLogs, icon: <CloudQueue />, color: "#4facfe" },
          { label: "Usuários Ativos", value: new Set(rows.map(r => r.user?.email).filter(Boolean)).size, icon: <Person />, color: "#43e97b" },
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
              <Avatar sx={{ bgcolor: stat.color + "20", color: stat.color, width: 42, height: 42 }}>
                {stat.icon}
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1 }}>
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

      {/* Filters Bar */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <Grid container spacing={2} sx={{ alignItems: "center" }}>
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Pesquisar nos logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: <Search fontSize="small" sx={{ color: "text.secondary", mr: 1 }} />,
                },
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <TextField
              select
              size="small"
              fullWidth
              label="Filtrar por Prefeitura"
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
            >
              <MenuItem value=""><em>Todas as Prefeituras</em></MenuItem>
              {organizations.map((org) => (
                <MenuItem key={org.id} value={org.id}>{org.name}</MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <TextField
              size="small"
              fullWidth
              label="Filtrar por Usuário"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <TextField
              size="small"
              fullWidth
              label="Filtrar por Evento / Ação"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            />
          </Grid>
        </Grid>
      </Paper>

      {loading && <LinearProgress sx={{ borderRadius: 1 }} />}

      {/* Console DataGrid */}
      <Paper elevation={0} sx={{ height: 600, borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <DataGrid
          rows={filteredRows}
          columns={columns}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25, page: 0 } },
          }}
          sx={{
            border: "none",
            "& .MuiDataGrid-cell": { fontSize: 13 },
            "& .MuiDataGrid-columnHeaders": { bgcolor: "action.hover", fontSize: 13, fontWeight: 700 },
          }}
        />
      </Paper>

      {/* Dialog Metadata Viewer */}
      <Dialog
        open={Boolean(selectedMetadata)}
        onClose={() => setSelectedMetadata(null)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="h6" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
              <Code color="primary" /> Detalhes do Evento (JSON)
            </Typography>
            <IconButton size="small" onClick={() => setSelectedMetadata(null)}>×</IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Box
            component="pre"
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: "#0f172a",
              color: "#38bdf8",
              fontFamily: "monospace",
              fontSize: 12,
              overflow: "auto",
              maxHeight: 400,
            }}
          >
            {JSON.stringify(selectedMetadata, null, 2)}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="contained" onClick={() => setSelectedMetadata(null)} sx={{ borderRadius: 2 }}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
