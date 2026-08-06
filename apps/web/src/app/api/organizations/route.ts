import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
export async function GET() {
  try {
    const tenant = await requireTenant("organization.read");
    const organizations =
      tenant.role === "SUPER_ADMIN"
        ? await prisma.organization.findMany({
            where: { deletedAt: null },
            orderBy: { name: "asc" },
          })
        : await prisma.organization.findMany({
            where: { id: tenant.organizationId!, deletedAt: null },
          });
    return Response.json(
      organizations.map((item) => ({
        ...item,
        storageLimit: item.storageLimit.toString(),
      })),
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 403 },
    );
  }
}
