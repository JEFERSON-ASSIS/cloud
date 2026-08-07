import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import {
  assignableMenuKeys,
  editableRoleNames,
  menuKeysFromPermissions,
  navItemDefinitions,
} from "@/lib/nav-items";
import type { Permission } from "@i7ai/types";

export async function GET() {
  try {
    const tenant = await requireTenant("user.manage");
    if (tenant.role !== "SUPER_ADMIN") {
      return Response.json(
        { error: "Apenas Super Administradores podem gerenciar o menu por perfil." },
        { status: 403 },
      );
    }

    const roles = await prisma.role.findMany({
      where: { name: { in: [...editableRoleNames] } },
      include: {
        menuItems: { select: { menuKey: true } },
        permissions: { include: { permission: { select: { key: true } } } },
      },
      orderBy: { name: "asc" },
    });

    const catalog = navItemDefinitions.map(({ key, label, href, superAdminOnly }) => ({
      key,
      label,
      href,
      superAdminOnly: Boolean(superAdminOnly),
      assignable: !superAdminOnly,
    }));

    const matrix = Object.fromEntries(
      editableRoleNames.map((roleName) => {
        const role = roles.find((item) => item.name === roleName);
        const stored = role?.menuItems.map((item) => item.menuKey) ?? [];
        if (stored.length > 0) {
          return [roleName, stored];
        }
        const permissions = (role?.permissions.map((item) => item.permission.key) ??
          []) as Permission[];
        return [roleName, menuKeysFromPermissions(permissions)];
      }),
    );

    return Response.json({
      catalog,
      assignableMenuKeys: assignableMenuKeys(),
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
