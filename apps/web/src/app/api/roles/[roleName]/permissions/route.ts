import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { editableRoleNames } from "@/lib/nav-items";
import {
  assignablePermissionKeys,
  isPermissionKey,
} from "@/lib/permission-catalog";

type Params = Promise<{ roleName: string }>;

export async function PUT(
  request: Request,
  { params }: { params: Params },
) {
  try {
    const tenant = await requireTenant("user.manage");
    if (tenant.role !== "SUPER_ADMIN") {
      return Response.json(
        { error: "Apenas Super Administradores podem gerenciar permissões por perfil." },
        { status: 403 },
      );
    }

    const { roleName } = await params;
    if (!(editableRoleNames as readonly string[]).includes(roleName)) {
      return Response.json(
        { error: "Perfil inválido ou não editável." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as { permissionKeys?: unknown };
    if (
      !Array.isArray(body.permissionKeys) ||
      body.permissionKeys.some((key) => typeof key !== "string")
    ) {
      return Response.json(
        { error: "Informe a lista de permissões (permissionKeys)." },
        { status: 400 },
      );
    }

    const allowed = new Set(assignablePermissionKeys());
    const permissionKeys = Array.from(
      new Set(
        body.permissionKeys.filter(
          (key): key is string =>
            typeof key === "string" && isPermissionKey(key) && allowed.has(key),
        ),
      ),
    );

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      return Response.json({ error: "Perfil não encontrado." }, { status: 404 });
    }

    const permissions = await prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
      select: { id: true, key: true },
    });
    if (permissions.length !== permissionKeys.length) {
      return Response.json(
        { error: "Uma ou mais permissões são inválidas." },
        { status: 400 },
      );
    }

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.rolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId: role.id,
          permissionId: permission.id,
        })),
      }),
    ]);

    return Response.json({
      ok: true,
      roleName,
      permissionKeys: permissions.map((item) => item.key),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 400 },
    );
  }
}
