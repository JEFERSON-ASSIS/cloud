import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { editableRoleNames } from "@/lib/nav-items";
import { permissionCatalog } from "@/lib/permission-catalog";

export async function GET() {
  try {
    const tenant = await requireTenant("user.manage");
    if (tenant.role !== "SUPER_ADMIN") {
      return Response.json(
        { error: "Apenas Super Administradores podem gerenciar permissões por perfil." },
        { status: 403 },
      );
    }

    const roles = await prisma.role.findMany({
      where: { name: { in: [...editableRoleNames] } },
      include: {
        permissions: { include: { permission: { select: { key: true } } } },
      },
      orderBy: { name: "asc" },
    });

    const matrix = Object.fromEntries(
      editableRoleNames.map((roleName) => {
        const role = roles.find((item) => item.name === roleName);
        const keys = role?.permissions.map((item) => item.permission.key) ?? [];
        return [roleName, keys];
      }),
    );

    return Response.json({
      catalog: permissionCatalog,
      roles: editableRoleNames,
      matrix,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 400 },
    );
  }
}
