import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { cleanName, assertFolder } from "@/server/documents";
import { ensureDriveRoot } from "@/server/google-drive";
import { writeAudit } from "@/server/audit";
import { assertSectorPermission } from "@i7ai/security";
import { canManageDocuments } from "@/server/document-access";

export async function POST(request: Request) {
  let remoteId: string | undefined;
  try {
    const tenant = await requireTenant("document.read");
    const body = (await request.json()) as {
      name?: string;
      parentId?: string | null;
      sectorId?: string | null;
      storageSpaceId?: string | null;
      organizationId?: string;
    };
    const name = cleanName(body.name ?? "");
    const organizationId = tenant.role === "SUPER_ADMIN" && body.organizationId
      ? body.organizationId
      : tenant.organizationId;
    if (!organizationId) throw new Error("Selecione uma empresa ou prefeitura.");
    const parent = await assertFolder(organizationId, body.parentId);

    let sectorId = body.sectorId || null;
    let storageSpaceId = body.storageSpaceId || null;

    if (parent) {
      sectorId = parent.sectorId;
      storageSpaceId = parent.storageSpaceId;
    }

    if (sectorId) {
      const sector = await prisma.sector.findFirst({ where: { id: sectorId, organizationId, deletedAt: null } });
      if (!sector) throw new Error("A secretaria não pertence à empresa selecionada.");
    }
    if (storageSpaceId) {
      const storageSpace = await prisma.storageSpace.findFirst({
        where: { id: storageSpaceId, organizationId, ...(sectorId ? { sectorId } : {}), deletedAt: null },
      });
      if (!storageSpace) throw new Error("O espaço de armazenamento não pertence à empresa e secretaria selecionadas.");
    }

    // Validar permissões da secretaria se fornecida
    const canMutate = canManageDocuments(tenant);
    if (sectorId) {
      const membership = await prisma.sectorUser.findUnique({
        where: {
          sectorId_userId: {
            sectorId,
            userId: tenant.userId,
          },
        },
      });
      assertSectorPermission(membership?.role, "EDITOR", canMutate);
    }

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const { drive, rootFolderId } = await ensureDriveRoot(
      organization.id,
      organization.name,
    );
    remoteId = await drive.createFolder(
      name,
      parent?.storageFolderId ?? rootFolderId,
    );
    const folder = await prisma.folder.create({
      data: {
        organizationId: organization.id,
        parentId: parent?.id ?? null,
        sectorId,
        storageSpaceId,
        name,
        storageFolderId: remoteId,
        createdById: tenant.userId,
      },
    });
    await writeAudit({
      organizationId: organization.id,
      userId: tenant.userId,
      action: "FOLDER_CREATE",
      resourceType: "Folder",
      resourceId: folder.id,
      metadata: { name },
    });
    return Response.json(folder, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível criar a pasta.",
      },
      { status: 400 },
    );
  }
}
