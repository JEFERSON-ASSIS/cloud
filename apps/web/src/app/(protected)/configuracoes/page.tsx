import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { NotificationsClient } from "./NotificationsClient";
import { UploadLimitClient } from "./UploadLimitClient";
import { Business, Cloud, Security } from "@mui/icons-material";
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
  Stack,
  Typography,
} from "@mui/material";

export default async function SettingsPage() {
  const tenant = await requireTenant("organization.read");
  const [organization, connection, managed] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: tenant.organizationId! },
    }),
    prisma.storageConnection.findFirst({
      where: {
        organizationId: tenant.organizationId!,
        provider: "GOOGLE_DRIVE",
        deletedAt: null,
      },
      include: { googleDrive: true },
    }),
    prisma.document.aggregate({
      where: { organizationId: tenant.organizationId!, deletedAt: null },
      _sum: { size: true },
      _count: true,
    }),
  ]);
  const used = Number(
      connection?.googleDrive?.quotaUsed ?? managed._sum.size ?? 0,
    ),
    limit = Number(
      connection?.googleDrive?.quotaLimit ?? organization.storageLimit,
    ),
    percentage = limit ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Configurações
        </Typography>
        <Typography color="text.secondary">
          Dados, armazenamento e segurança da empresa atual.
        </Typography>
      </Box>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Business color="primary" />
              <Typography variant="h6" sx={{ mt: 1 }}>
                Empresa
              </Typography>
              <Typography variant="h5">{organization.name}</Typography>
              <Typography color="text.secondary">
                Identificador: {organization.slug}
              </Typography>
              <Stack direction="row" sx={{ gap: 1, mt: 2 }}>
                <Chip
                  label={
                    organization.status === "ACTIVE" ? "Ativa" : "Suspensa"
                  }
                  color={
                    organization.status === "ACTIVE" ? "success" : "warning"
                  }
                />
                <Chip
                  label={`${managed._count} documentos`}
                  variant="outlined"
                />
              </Stack>
            </CardContent>
            <CardActions>
              <Button href="/empresas">Gerenciar empresa</Button>
              <Button href="/usuarios">Gerenciar usuários</Button>
            </CardActions>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Cloud color="primary" />
              <Typography variant="h6" sx={{ mt: 1 }}>
                Armazenamento
              </Typography>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography>
                  {connection?.googleDrive?.accountEmail ??
                    (tenant.role === "SUPER_ADMIN"
                      ? "Google Drive não conectado"
                      : "Armazenamento em nuvem não conectado")}
                </Typography>
                <Chip
                  size="small"
                  label={
                    connection?.status === "CONNECTED"
                      ? "Conectado"
                      : "Desconectado"
                  }
                  color={
                    connection?.status === "CONNECTED" ? "success" : "default"
                  }
                />
              </Stack>
              <LinearProgress
                variant="determinate"
                value={percentage}
                sx={{ mt: 2 }}
              />
              <Typography variant="caption">
                {(used / 1_073_741_824).toFixed(2)} GB utilizados
                {limit ? ` de ${(limit / 1_073_741_824).toFixed(2)} GB` : ""}
              </Typography>
            </CardContent>
            <CardActions>
              <Button variant="contained" href="/integracoes">
                {tenant.role === "SUPER_ADMIN"
                  ? "Configurar Google Drive"
                  : "Configurar armazenamento"}
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>
      <UploadLimitClient />
      <NotificationsClient />
      <Alert icon={<Security />} severity="info">
        <strong>Segurança:</strong> credenciais de armazenamento e configurações de notificação são criptografadas com chave AES-256,
        permissões são verificadas no servidor e todos os documentos e backups são
        isolados por empresa.
      </Alert>
    </Stack>
  );
}

