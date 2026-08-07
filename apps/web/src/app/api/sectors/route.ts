import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { getGoogleDriveProvider } from "@/server/drive";
import { writeAudit } from "@/server/audit";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant("document.read");
    const url = new URL(request.url);
    const paramOrgId = url.searchParams.get("organizationId");

    const organizationId =
      tenant.role === "SUPER_ADMIN" && paramOrgId
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
        storageSpaces: {
          where: { deletedAt: null },
        },
        _count: {
          select: {
            users: true,
            backupFiles: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const formattedSectors = sectors.map((s) => ({
      ...s,
      quotaLimit: s.quotaLimit.toString(),
      usedBytes: BigInt(0).toString(),
      documentCount: 0,
      memberCount: s._count.users,
      spaceCount: s.storageSpaces.length,
    }));

    return Response.json(formattedSectors);
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
      quotaLimitGB?: number | string;
      organizationId?: string;
    };

    const organizationId =
      tenant.role === "SUPER_ADMIN" && body.organizationId
        ? body.organizationId
        : tenant.organizationId;

    if (!organizationId) {
      return Response.json({ error: "Empresa / Prefeitura é obrigatória." }, { status: 400 });
    }

    const name = body.name?.trim();
    if (!name) {
      return Response.json({ error: "Nome da secretaria é obrigatório." }, { status: 400 });
    }

    const quotaLimitGB = Number(body.quotaLimitGB ?? 100);
    const quotaLimit = BigInt(quotaLimitGB) * BigInt(1073741824);

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });

    const otherSectors = await prisma.sector.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
    });

    const currentTotalQuota = otherSectors.reduce((sum, s) => sum + s.quotaLimit, BigInt(0));

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

    let sector = await prisma.sector.findFirst({
      where: { organizationId, name },
    });

    if (sector && !sector.deletedAt) {
      return Response.json(
        { error: `Já existe uma secretaria cadastrada com o nome "${name}" nesta empresa/prefeitura.` },
        { status: 400 }
      );
    }

    if (sector && sector.deletedAt) {
      sector = await prisma.sector.update({
        where: { id: sector.id },
        data: { deletedAt: null, quotaLimit },
      });
    } else {
      sector = await prisma.sector.create({
        data: {
          organizationId,
          name,
          quotaLimit,
        },
      });
    }

    // Tentar instanciar imediatamente as pastas no Google Drive se houver conexão
    try {
      const driveInfo = await getGoogleDriveProvider(organizationId);

      if (driveInfo) {
        const { drive } = driveInfo;

        // 1. Localizar ou criar a pasta mae da Empresa/Prefeitura no Google Drive
        const rootItems = await drive.list("root");
        let mainOrgFolder = rootItems.find(
          (i) => i.name === organization.name && i.mimeType === "application/vnd.google-apps.folder"
        );
        let mainOrgFolderId = mainOrgFolder?.id;

        if (!mainOrgFolderId) {
          mainOrgFolderId = await drive.createFolder(organization.name);
          await writeAudit({
            organizationId,
            userId: tenant.userId,
            action: "GOOGLE_DRIVE_FOLDER_CREATE",
            resourceType: "ORGANIZATION_FOLDER",
            resourceId: mainOrgFolderId,
            metadata: { name: organization.name },
          });
        }

        // 2. Localizar ou criar a pasta da Secretaria dentro da pasta da Empresa
        const orgItems = await drive.list(mainOrgFolderId);
        let sectorFolder = orgItems.find(
          (i) => i.name === sector.name && i.mimeType === "application/vnd.google-apps.folder"
        );
        let sectorDriveFolderId = sectorFolder?.id;

        if (!sectorDriveFolderId) {
          sectorDriveFolderId = await drive.createFolder(sector.name, mainOrgFolderId);
          await writeAudit({
            organizationId,
            userId: tenant.userId,
            action: "GOOGLE_DRIVE_FOLDER_CREATE",
            resourceType: "SECTOR_FOLDER",
            resourceId: sectorDriveFolderId,
            metadata: { name: sector.name, parentFolderId: mainOrgFolderId },
          });
        }

        // 3. Localizar ou criar a subpasta Backups dentro da Secretaria
        const sectorItems = await drive.list(sectorDriveFolderId);
        let backupsFolder = sectorItems.find(
          (i) => i.name === "Backups" && i.mimeType === "application/vnd.google-apps.folder"
        );
        if (!backupsFolder) {
          await drive.createFolder("Backups", sectorDriveFolderId);
        }

        // 4. Salvar ou atualizar StorageSpace
        const existingStorageSpace = await prisma.storageSpace.findFirst({
          where: { organizationId, sectorId: sector.id },
        });

        if (existingStorageSpace) {
          await prisma.storageSpace.update({
            where: { id: existingStorageSpace.id },
            data: { rootFolderId: sectorDriveFolderId, deletedAt: null },
          });
        } else {
          await prisma.storageSpace.create({
            data: {
              organizationId,
              sectorId: sector.id,
              name: sector.name,
              rootFolderId: sectorDriveFolderId,
            },
          });
        }

        await writeAudit({
          organizationId,
          userId: tenant.userId,
          action: "SECTOR_CREATE",
          resourceType: "SECTOR",
          resourceId: sector.id,
          metadata: { name: sector.name, driveFolderId: sectorDriveFolderId },
        });
      }
    } catch (errDrive) {
      console.warn("Aviso: Não foi possível instanciar pastas no Google Drive na criação da secretaria:", errDrive);
      await writeAudit({
        organizationId,
        userId: tenant.userId,
        action: "ERROR",
        resourceType: "SECTOR_DRIVE_CREATE",
        resourceId: sector.id,
        metadata: { error: errDrive instanceof Error ? errDrive.message : String(errDrive) },
      });
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
