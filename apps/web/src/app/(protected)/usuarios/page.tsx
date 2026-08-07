import { prisma } from "@i7ai/database";
import { Card } from "@mui/material";
import { requireTenant } from "@/server/tenant";
import { PageHeader } from "@/components/PageHeader/PageHeader";
import { UsersTable } from "./users-table";
export default async function UsersPage() {
  const tenant = await requireTenant("user.read");
  const rows = await prisma.organizationUser.findMany({
    where: { organizationId: tenant.organizationId! },
    include: { user: true, role: true },
    orderBy: { user: { name: "asc" } },
  });
  return (
    <UsersTable
      rows={rows.map(({ user, role }) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: role.name,
        status: user.status,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      }))}
    />
  );
}
