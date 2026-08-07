import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { getGoogleDriveProvider } from "@/server/drive";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireTenant("user.manage");
    const { id } = await params;

    // Verificar se o setor existe (Super Admin acessa qualquer setor)
    const sectorObj = await prisma.sector.findFirstOrThrow({
      where: tenant.role === "SUPER_ADMIN"
        ? { id, deletedAt: null }
        : { id, organizationId: tenant.organizationId!, deletedAt: null },
    });
    const organizationId = sectorObj.organizationId;

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

    // Verificar se o setor existe (Super Admin deleta qualquer setor)
    const sectorObj = await prisma.sector.findFirstOrThrow({
      where: tenant.role === "SUPER_ADMIN"
        ? { id, deletedAt: null }
        : { id, organizationId: tenant.organizationId!, deletedAt: null },
    });
    const organizationId = sectorObj.organizationId;

    // Tentar excluir a pasta da secretaria no Google Drive pelo ID exato
    try {
      const storageSpace = await prisma.storageSpace.findFirst({
        where: { organizationId, sectorId: id, deletedAt: null },
      });

      if (storageSpace?.rootFolderId) {
        const driveInfo = await getGoogleDriveProvider(organizationId);
        if (driveInfo) {
          await driveInfo.drive.delete(storageSpace.rootFolderId);
        }
      }
    } catch (errDrive) {
      console.warn("Aviso: Não foi possível deletar a pasta da secretaria no Google Drive:", errDrive);
    }

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
