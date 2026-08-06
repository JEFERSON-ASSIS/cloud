import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireTenant("user.manage");
    const { id } = await params;
    const organizationId = tenant.organizationId!;

    // Verificar se o setor pertence à organização do usuário
    await prisma.sector.findFirstOrThrow({
      where: { id, organizationId, deletedAt: null },
    });

    const body = (await request.json()) as {
      name?: string;
      quotaLimit?: number | string;
    };

    const data: Parameters<typeof prisma.sector.update>[0]["data"] = {};

    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) {
        return Response.json({ error: "Nome não pode ser vazio." }, { status: 400 });
      }
      data.name = name;
    }

    if (body.quotaLimit !== undefined) {
      const newQuotaLimit = BigInt(body.quotaLimit);

      // Obter limite da organização
      const organization = await prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
      });

      // Calcular soma das outras secretarias
      const otherSectors = await prisma.sector.findMany({
        where: {
          organizationId,
          deletedAt: null,
          id: { not: id },
        },
      });

      const otherTotalQuota = otherSectors.reduce((sum, s) => sum + s.quotaLimit, BigInt(0));
      if (otherTotalQuota + newQuotaLimit > organization.storageLimit) {
        return Response.json(
          {
            error: `A soma das quotas excede o limite contratado da organização (${(
              Number(organization.storageLimit) /
              1024 /
              1024 /
              1024
            ).toFixed(1)} GB).`,
          },
          { status: 400 }
        );
      }

      data.quotaLimit = newQuotaLimit;
    }

    const updated = await prisma.sector.update({
      where: { id },
      data,
    });

    return Response.json({
      ...updated,
      quotaLimit: updated.quotaLimit.toString(),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar secretaria." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireTenant("user.manage");
    const { id } = await params;
    const organizationId = tenant.organizationId!;

    // Verificar se o setor pertence à organização
    await prisma.sector.findFirstOrThrow({
      where: { id, organizationId, deletedAt: null },
    });

    // Soft delete
    const deleted = await prisma.sector.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return Response.json({
      ...deleted,
      quotaLimit: deleted.quotaLimit.toString(),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao excluir secretaria." },
      { status: 400 }
    );
  }
}
