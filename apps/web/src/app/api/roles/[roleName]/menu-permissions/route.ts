import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { assignableMenuKeys, editableRoleNames, isMenuKey } from "@/lib/nav-items";

type Params = Promise<{ roleName: string }>;

export async function PUT(
  request: Request,
  { params }: { params: Params },
) {
  try {
    const tenant = await requireTenant("user.manage");
    if (tenant.role !== "SUPER_ADMIN") {
      return Response.json(
        { error: "Apenas Super Administradores podem gerenciar o menu por perfil." },
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

    const body = (await request.json()) as { menuKeys?: unknown };
    if (!Array.isArray(body.menuKeys) || body.menuKeys.some((key) => typeof key !== "string")) {
      return Response.json(
        { error: "Informe a lista de itens do menu (menuKeys)." },
        { status: 400 },
      );
    }

    const allowed = new Set(assignableMenuKeys());
    const menuKeys = Array.from(
      new Set(
        body.menuKeys.filter(
          (key): key is string => typeof key === "string" && isMenuKey(key) && allowed.has(key),
        ),
      ),
    );

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      return Response.json({ error: "Perfil não encontrado." }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.roleMenuItem.deleteMany({ where: { roleId: role.id } }),
      prisma.roleMenuItem.createMany({
        data: menuKeys.map((menuKey) => ({
          roleId: role.id,
          menuKey,
        })),
      }),
    ]);

    return Response.json({ ok: true, roleName, menuKeys });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 400 },
    );
  }
}
