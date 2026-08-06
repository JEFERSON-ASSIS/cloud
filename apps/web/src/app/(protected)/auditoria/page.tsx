"use client";
import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { formatCuiabaDateTime } from "@/lib/date";

type Audit = {
  id: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ip?: string;
  createdAt: string;
  user?: { name: string; email: string };
};
const labels: Record<string, string> = {
  LOGIN: "Login",
  LOGOUT: "Logout",
  DOCUMENT_UPLOAD: "Upload",
  DOCUMENT_DOWNLOAD: "Download",
  DOCUMENT_PREVIEW: "Visualização",
  DOCUMENT_DELETE: "Exclusão",
  DOCUMENT_RESTORE: "Restauração",
  DOCUMENT_RENAME: "Renomeação",
  DOCUMENT_MOVE: "Movimentação",
  FOLDER_CREATE: "Pasta criada",
  FOLDER_DELETE: "Pasta excluída",
  GOOGLE_DRIVE_CONNECTED: "Drive conectado",
  GOOGLE_DRIVE_DISCONNECTED: "Drive desconectado",
};
export default function AuditPage() {
  const [rows, setRows] = useState<Audit[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [action, setAction] = useState(""),
    [user, setUser] = useState("");
  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ action, user });
      const response = await fetch(`/api/audit?${params}`);
      const body = await response.json();
      if (response.ok) setRows(body);
      else setError(body.error);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [action, user]);
  const columns: GridColDef<Audit>[] = [
    {
      field: "createdAt",
      headerName: "Data",
      width: 180,
      valueFormatter: (v) => formatCuiabaDateTime(v),
    },
    {
      field: "user",
      headerName: "Usuário",
      flex: 1,
      minWidth: 180,
      valueGetter: (_v, row) => row.user?.name ?? "Sistema",
    },
    {
      field: "action",
      headerName: "Ação",
      width: 190,
      renderCell: (p) => (
        <Chip size="small" label={labels[p.value] ?? p.value} />
      ),
    },
    { field: "resourceType", headerName: "Recurso", width: 150 },
    {
      field: "resourceId",
      headerName: "Identificador",
      flex: 1,
      minWidth: 220,
    },
    { field: "ip", headerName: "IP", width: 140 },
  ];
  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Auditoria
        </Typography>
        <Typography color="text.secondary">
          Rastreabilidade das ações realizadas na empresa.
        </Typography>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 2 }}>
        <TextField
          size="small"
          label="Filtrar por usuário"
          value={user}
          onChange={(e) => setUser(e.target.value)}
        />
        <TextField
          size="small"
          label="Filtrar por ação"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
      </Stack>
      {loading && <LinearProgress />}
      <Paper variant="outlined" sx={{ height: 580 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25, page: 0 } },
          }}
        />
      </Paper>
    </Stack>
  );
}
