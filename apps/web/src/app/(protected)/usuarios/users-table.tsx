"use client";
import type { GridColDef } from "@mui/x-data-grid";
import { formatCuiabaDateTime } from "@/lib/date";
import { DataTable } from "@/components/DataTable/DataTable";
import { StatusChip } from "@/components/StatusChip/StatusChip";
type Row = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
};
const columns: GridColDef<Row>[] = [
  { field: "name", headerName: "Nome", flex: 1, minWidth: 180 },
  { field: "email", headerName: "E-mail", flex: 1, minWidth: 220 },
  { field: "role", headerName: "Perfil", width: 140 },
  {
    field: "status",
    headerName: "Status",
    width: 130,
    renderCell: ({ value }) => <StatusChip status={String(value)} />,
  },
  {
    field: "lastLoginAt",
    headerName: "Último acesso",
    width: 180,
    valueFormatter: (value) =>
      value ? formatCuiabaDateTime(String(value)) : "Nunca",
  },
];
export function UsersTable({ rows }: { rows: Row[] }) {
  return <DataTable rows={rows} columns={columns} />;
}
