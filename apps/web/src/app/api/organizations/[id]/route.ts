import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireTenant("organization.manage");
    const { id } = await params;

    if (tenant.role !== "SUPER_ADMIN" && tenant.organizationId !== id) {
      return Response.json({ error: "Acesso negado." }, { status: 403 });
    }

    const body = await req.json();
    const { name, document, status, storageLimitGB } = body;

    const dataToUpdate: any = {};
    if (name) {
      dataToUpdate.name = name;
      dataToUpdate.slug = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }
    if (document !== undefined) dataToUpdate.document = document;
    if (status) dataToUpdate.status = status;
    if (storageLimitGB) {
      dataToUpdate.storageLimit = BigInt(storageLimitGB) * BigInt(1073741824);
    }

    const updated = await prisma.organization.update({
      where: { id },
      data: dataToUpdate,
    });

    return Response.json({
      ...updated,
      storageLimit: updated.storageLimit.toString(),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar organização." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireTenant("organization.manage");
    const { id } = await params;

    if (tenant.role !== "SUPER_ADMIN") {
      return Response.json({ error: "Apenas Super Admins podem excluir empresas/prefeituras." }, { status: 403 });
    }

    await prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao excluir organização." },
      { status: 500 }
    );
  }
}
