import { prisma } from "@i7ai/database";
import { Card, CardContent, Grid, Stack, Typography } from "@mui/material";
import { requireTenant } from "@/server/tenant";
import { PageHeader } from "@/components/PageHeader/PageHeader";
import { StatusChip } from "@/components/StatusChip/StatusChip";
export default async function OrganizationsPage() {
  const tenant = await requireTenant("organization.read");
  const organizations = await prisma.organization.findMany({
    where:
      tenant.role === "SUPER_ADMIN"
        ? { deletedAt: null }
        : { id: tenant.organizationId!, deletedAt: null },
    include: {
      _count: { select: { users: true, documents: true, backupRuns: true } },
      documents: { where: { deletedAt: null }, select: { size: true } },
    },
  });
  return (
    <>
      <PageHeader
        title="Empresas"
        description="Organizações e consumo de recursos."
      />
      <Grid container spacing={2}>
        {organizations.map((org) => (
          <Grid key={org.id} size={{ xs: 12, md: 6, xl: 4 }}>
            <Card>
              <CardContent>
                <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                  <Typography variant="h6">{org.name}</Typography>
                  <StatusChip status={org.status} />
                </Stack>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  {org.document ?? "Documento não informado"}
                </Typography>
                <Grid container spacing={2} sx={{ mt: 2 }}>
                  {[
                    ["Usuários", org._count.users],
                    ["Documentos", org._count.documents],
                    ["Backups", org._count.backupRuns],
                    [
                      "Uso",
                      `${(org.documents.reduce((sum, doc) => sum + Number(doc.size), 0) / 1_073_741_824).toFixed(2)} GB`,
                    ],
                  ].map(([label, value]) => (
                    <Grid key={label} size={6}>
                      <Typography variant="caption" color="text.secondary">
                        {label}
                      </Typography>
                      <Typography sx={{ fontWeight: 700 }}>{value}</Typography>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
