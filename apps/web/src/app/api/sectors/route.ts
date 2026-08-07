import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { getGoogleDriveProvider } from "@/server/drive";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant("document.read");
    const url = new URL(request.url);
    const paramOrgId = url.searchParams.get("organizationId");

    const organizationId = (tenant.role === "SUPER_ADMIN" && paramOrgId)
      ? paramOrgId
      : tenant.organizationId;

    if (!organizationId) {
      return Response.json([], { status: 200 });
    }

    const sectors = await prisma.sector.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            users: true,
            storageSpaces: true,
            documents: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return Response.json(
      sectors.map((s) => ({
        ...s,
        quotaLimit: s.quotaLimit.toString(),
      }))
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao listar secretarias." },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant("user.manage");
    const body = (await request.json()) as {
      name?: string;
      quotaLimit?: number | string;
      organizationId?: string;
    };

    const organizationId = (tenant.role === "SUPER_ADMIN" && body.organizationId)
      ? body.organizationId
      : tenant.organizationId;

    if (!organizationId) {
      return Response.json({ error: "Empresa/Prefeitura é obrigatória." }, { status: 400 });
    }

    const name = body.name?.trim();
    if (!name) {
      return Response.json({ error: "Nome é obrigatório." }, { status: 400 });
    }

    const quotaLimit = body.quotaLimit ? BigInt(body.quotaLimit) : BigInt(1073741824); // Default 1GB

    // Validar se a soma das quotas excede o limite da organização
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });

    const activeSectors = await prisma.sector.findMany({
      where: { organizationId, deletedAt: null },
    });

    const currentTotalQuota = activeSectors.reduce((sum, s) => sum + s.quotaLimit, BigInt(0));
    if (currentTotalQuota + quotaLimit > organization.storageLimit) {
      return Response.json(
        {
          error: `A soma das quotas das secretarias excede o limite contratado da organização (${(
            Number(organization.storageLimit) /
            1024 /
            1024 /
            1024
          ).toFixed(1)} GB).`,
        },
        { status: 400 }
      );
    }

    const sector = await prisma.sector.create({
      data: {
        organizationId,
        name,
        quotaLimit,
      },
    });

    // Tentar instanciar imediatamente as pastas no Google Drive se houver conexão
    try {
      const driveInfo = await getGoogleDriveProvider(organizationId);

      if (driveInfo) {
        const { drive, connection } = driveInfo;

        let mainOrgFolderId = connection.googleDrive?.rootFolderId || undefined;
        if (!mainOrgFolderId) {
          const rootItems = await drive.list("root");
          const existingOrgFolder = rootItems.find((i) => i.name === organization.name);
          if (existingOrgFolder) {
            mainOrgFolderId = existingOrgFolder.id;
          } else {
            mainOrgFolderId = await drive.createFolder(organization.name);
          }
          if (connection.googleDrive) {
            await prisma.googleDriveConnection.update({
              where: { id: connection.googleDrive.id },
              data: { rootFolderId: mainOrgFolderId },
            });
          }
        }

        const orgItems = await drive.list(mainOrgFolderId || "root");
        let sectorDriveFolderId = orgItems.find((i) => i.name === sector.name)?.id;
        if (!sectorDriveFolderId) {
          sectorDriveFolderId = await drive.createFolder(sector.name, mainOrgFolderId);
        }

        const sectorItems = await drive.list(sectorDriveFolderId);
        let backupsFolderId = sectorItems.find((i) => i.name === "Backups")?.id;
        if (!backupsFolderId) {
          await drive.createFolder("Backups", sectorDriveFolderId);
        }

        await prisma.storageSpace.create({
          data: {
            organizationId,
            sectorId: sector.id,
            name: sector.name,
            rootFolderId: sectorDriveFolderId,
          },
        });
      }
    } catch (errDrive) {
      console.warn("Aviso: Não foi possível instanciar pastas no Google Drive na criação da secretaria:", errDrive);
    }

    return Response.json(
      {
        ...sector,
        quotaLimit: sector.quotaLimit.toString(),
      },
      { status: 201 }
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao criar secretaria." },
      { status: 400 }
    );
  }
}
