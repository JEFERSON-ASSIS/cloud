"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import {
  DescriptionOutlined,
  CloudOutlined,
  BackupOutlined,
  ErrorOutlined,
  PeopleOutlined,
  HubOutlined,
} from "@mui/icons-material";
import { PageHeader } from "@/components/PageHeader/PageHeader";
import { MetricCard } from "@/components/MetricCard/MetricCard";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { formatCuiabaDateTime } from "@/lib/date";

const actionLabels: Record<string, string> = {
  LOGIN: "Login realizado",
  LOGOUT: "Logout realizado",
  GOOGLE_DRIVE_CONNECTED: "Google Drive conectado",
  GOOGLE_DRIVE_DISCONNECTED: "Google Drive desconectado",
  DOCUMENT_UPLOAD: "Documento enviado",
  DOCUMENT_DOWNLOAD: "Documento baixado",
  DOCUMENT_PREVIEW: "Documento visualizado",
  DOCUMENT_RENAME: "Documento renomeado",
  DOCUMENT_MOVE: "Documento movido",
  DOCUMENT_DELETE: "Documento excluído",
  DOCUMENT_RESTORE: "Documento restaurado",
  FOLDER_CREATE: "Pasta criada",
  FOLDER_RENAME: "Pasta renomeada",
  FOLDER_MOVE: "Pasta movida",
  FOLDER_DELETE: "Pasta excluída",
  FOLDER_RESTORE: "Pasta restaurada",
  SECTOR_CREATE: "Secretaria criada",
  ORGANIZATION_CREATE: "Empresa criada",
};

type DashboardData = {
  organizationName: string;
  totalDocuments: number;
  usedBytes: string;
  usedGB: string;
  storageLimitGB: string;
  usedPercentage: string;
  backupSuccessCount: number;
  backupFailedCount: number;
  activeUsersCount: number;
  activeIntegrationsCount: number;
  recentLogs: Array<{
    id: string;
    action: string;
    userName: string;
    createdAt: string;
  }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const activeOrgId = localStorage.getItem("active-org-id") || "";
      const url = activeOrgId
        ? `/api/dashboard/stats?organizationId=${activeOrgId}`
        : "/api/dashboard/stats";

      const res = await fetch(url);
      const body = await res.json();

      if (res.ok) {
        setData(body);
      } else {
        setError(body.error || "Erro ao carregar o painel.");
      }
    } catch {
      setError("Falha na comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
    window.addEventListener("active-org-changed", loadStats);
    return () => window.removeEventListener("active-org-changed", loadStats);
  }, [loadStats]);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Visão Geral"
        description={`Acompanhe a operação de ${data?.organizationName || "sua empresa"}.`}
      />

      {error && <Alert severity="error" onClose={() => setError("")} sx={{ borderRadius: 2 }}>{error}</Alert>}
      {loading && <LinearProgress sx={{ borderRadius: 1 }} />}

      {/* Cards de Métricas */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <MetricCard
            label="Total de documentos"
            value={data?.totalDocuments ?? 0}
            caption="Arquivos disponíveis"
            icon={<DescriptionOutlined />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <MetricCard
            label="Armazenamento usado"
            value={`${data?.usedGB ?? "0.00"} GB`}
            caption={`${data?.usedPercentage ?? "0.0"}% da cota contratada`}
            icon={<CloudOutlined />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <MetricCard
            label="Backups realizados"
            value={data?.backupSuccessCount ?? 0}
            caption="Histórico completo"
            icon={<BackupOutlined />}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <MetricCard
            label="Backups com erro"
            value={data?.backupFailedCount ?? 0}
            caption="Exigem atenção"
            icon={<ErrorOutlined />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <MetricCard
            label="Usuários ativos"
            value={data?.activeUsersCount ?? 0}
            caption="Com acesso à empresa"
            icon={<PeopleOutlined />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <MetricCard
            label="Integrações ativas"
            value={data?.activeIntegrationsCount ?? 0}
            caption="Provedores conectados"
            icon={<HubOutlined />}
          />
        </Grid>
      </Grid>

      {/* Atividades Recentes */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }}>
          <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Atividades recentes
              </Typography>
              {!data?.recentLogs || data.recentLogs.length === 0 ? (
                <EmptyState
                  title="Nenhuma atividade registrada"
                  description="As ações realizadas nesta empresa aparecerão aqui."
                />
              ) : (
                <Stack spacing={1.5}>
                  {data.recentLogs.map((item) => (
                    <Box
                      key={item.id}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: "action.hover",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {actionLabels[item.action] || item.action}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Por: {item.userName}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {formatCuiabaDateTime(item.createdAt)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
