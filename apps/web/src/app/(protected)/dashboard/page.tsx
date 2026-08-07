import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { Box, Card, CardContent, Grid, Stack, Typography, LinearProgress } from "@mui/material";
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
import { DashboardActivityChart } from "@/components/DashboardActivityChart/DashboardActivityChart";
import { subDays } from "date-fns";
import { formatCuiabaDateTime, formatCuiabaDayMonth } from "@/lib/date";

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
};

export default async function DashboardPage() {
  const tenant = await requireTenant("dashboard.read");
  const organizationId = tenant.organizationId!;
  const since = subDays(new Date(), 29);

  const isPrivileged = tenant.role === "SUPER_ADMIN" || tenant.role === "ADMIN";

  // Se o usuário não for ADMIN/SUPER_ADMIN, buscar as secretarias onde ele é membro
  const userSectorIds = isPrivileged
    ? []
    : (
        await prisma.sectorUser.findMany({
          where: { userId: tenant.userId },
          select: { sectorId: true },
        })
      ).map((s) => s.sectorId);

  const documentWhere = isPrivileged
    ? { organizationId, deletedAt: null }
    : { organizationId, deletedAt: null, sectorId: { in: userSectorIds } };

  const [
    documents,
    storage,
    backups,
    failed,
    users,
    integrations,
    recent,
    activity,
    driveConnection,
    sectors,
  ] = await Promise.all([
    prisma.document.count({ where: documentWhere }),
    prisma.document.aggregate({
      where: documentWhere,
      _sum: { size: true },
    }),
    prisma.backupRun.count({ where: { organizationId } }),
    prisma.backupRun.count({ where: { organizationId, status: "FAILED" } }),
    prisma.organizationUser.count({
      where: { organizationId, user: { status: "ACTIVE", deletedAt: null } },
    }),
    prisma.storageConnection.count({
      where: { organizationId, status: "CONNECTED", deletedAt: null },
    }),
    prisma.auditLog.findMany({
      where: isPrivileged ? { organizationId } : { organizationId, userId: tenant.userId },
      take: 6,
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: isPrivileged
        ? { organizationId, createdAt: { gte: since } }
        : { organizationId, userId: tenant.userId, createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.googleDriveConnection.findFirst({
      where: {
        storageConnection: {
          organizationId,
          status: "CONNECTED",
          deletedAt: null,
        },
      },
      select: { quotaUsed: true, quotaLimit: true },
    }),
    prisma.sector.findMany({
      where: isPrivileged
        ? { organizationId, deletedAt: null }
        : { organizationId, deletedAt: null, id: { in: userSectorIds } },
      include: {
        documents: {
          where: { deletedAt: null, status: "AVAILABLE" },
          select: { size: true },
        },
      },
    }),
  ]);
  const managedBytes = Number(storage._sum.size ?? 0);
  const storageBytes = Number(driveConnection?.quotaUsed ?? managedBytes);
  const quotaBytes = Number(driveConnection?.quotaLimit ?? 0);
  const daily = new Map<string, number>();
  for (let offset = 29; offset >= 0; offset -= 1)
    daily.set(formatCuiabaDayMonth(subDays(new Date(), offset)), 0);
  for (const item of activity) {
    const day = formatCuiabaDayMonth(item.createdAt);
    daily.set(day, (daily.get(day) ?? 0) + 1);
  }
  const chartData = [...daily].map(([day, actions]) => ({ day, actions }));

  const sectorData = sectors.map((sec) => {
    const totalSize = sec.documents.reduce((sum, doc) => sum + Number(doc.size), 0);
    const limitBytes = Number(sec.quotaLimit);
    const percentage = limitBytes > 0 ? (totalSize / limitBytes) * 100 : 0;
    return {
      id: sec.id,
      name: sec.name,
      usedGB: (totalSize / 1_073_741_824).toFixed(2),
      limitGB: (limitBytes / 1_073_741_824).toFixed(1),
      percentage: Math.min(percentage, 100),
    };
  });

  const metrics = [
    [
      "Total de documentos",
      documents,
      "Arquivos disponíveis",
      <DescriptionOutlined key="1" />,
    ],
    [
      "Armazenamento usado",
      `${(storageBytes / 1_073_741_824).toFixed(2)} GB`,
      quotaBytes ? `${((storageBytes / quotaBytes) * 100).toFixed(1)}% da cota contratada` : "Nuvem segura i7AI",
      <CloudOutlined key="2" />,
    ],
    [
      "Backups realizados",
      backups,
      "Histórico completo",
      <BackupOutlined key="3" />,
    ],
    ["Backups com erro", failed, "Exigem atenção", <ErrorOutlined key="4" />],
    [
      "Usuários ativos",
      users,
      "Com acesso à empresa",
      <PeopleOutlined key="5" />,
    ],
    [
      "Integrações ativas",
      integrations,
      "Provedores conectados",
      <HubOutlined key="6" />,
    ],
  ] as const;
  return (
    <>
      <PageHeader
        title="Visão geral"
        description={`Acompanhe a operação de ${tenant.organizationId ? "sua empresa" : "todas as empresas"}.`}
      />
      <Grid container spacing={2}>
        {metrics.map(([label, value, caption, icon]) => (
          <Grid key={label} size={{ xs: 12, sm: 6, lg: 4 }}>
            <MetricCard
              label={label}
              value={value}
              caption={caption}
              icon={icon}
            />
          </Grid>
        ))}
      </Grid>
      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardContent>
              <Typography variant="h6">
                Atividade nos últimos 30 dias
              </Typography>
              <DashboardActivityChart data={chartData} />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2}>
            <Card>
              <CardContent>
                <Typography variant="h6">Atividades recentes</Typography>
                {recent.length === 0 ? (
                  <EmptyState
                    title="Tudo tranquilo por aqui"
                    description="As ações importantes aparecerão nesta lista."
                  />
                ) : (
                  <Stack
                    divider={
                      <Box sx={{ borderBottom: 1, borderColor: "divider" }} />
                    }
                  >
                    {recent.map((item) => (
                      <Box key={item.id} sx={{ py: 1.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 650 }}>
                          {actionLabels[item.action] ??
                            item.action.replaceAll("_", " ")}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatCuiabaDateTime(item.createdAt)}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>

            {sectorData.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>Cota por Secretaria</Typography>
                  <Stack spacing={2.5}>
                    {sectorData.map((sec) => (
                      <Box key={sec.id}>
                        <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{sec.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {sec.usedGB} / {sec.limitGB} GB ({sec.percentage.toFixed(1)}%)
                          </Typography>
                        </Stack>
                        <LinearProgress 
                          variant="determinate" 
                          value={sec.percentage} 
                          color={sec.percentage > 90 ? "error" : sec.percentage > 75 ? "warning" : "primary"}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>
      </Grid>
    </>
  );
}

