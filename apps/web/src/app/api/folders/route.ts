import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { cleanName, assertFolder } from "@/server/documents";
import { ensureDriveRoot } from "@/server/google-drive";
import { writeAudit } from "@/server/audit";
import { assertSectorPermission } from "@i7ai/security";

export async function POST(request: Request) {
  let remoteId: string | undefined;
  try {
    const tenant = await requireTenant("document.manage");
    const body = (await request.json()) as {
      name?: string;
      parentId?: string | null;
      sectorId?: string | null;
      storageSpaceId?: string | null;
    };
    const name = cleanName(body.name ?? "");
    const parent = await assertFolder(tenant.organizationId!, body.parentId);

    let sectorId = body.sectorId || null;
    let storageSpaceId = body.storageSpaceId || null;

    if (parent) {
      sectorId = parent.sectorId;
      storageSpaceId = parent.storageSpaceId;
    }

    // Validar permissões da secretaria se fornecida
    const isOrgAdminOrSuper = tenant.role === "SUPER_ADMIN" || tenant.role === "ADMIN";
    if (sectorId) {
      const membership = await prisma.sectorUser.findUnique({
        where: {
          sectorId_userId: {
            sectorId,
            userId: tenant.userId,
          },
        },
      });
      assertSectorPermission(membership?.role, "EDITOR", isOrgAdminOrSuper);
    }

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: tenant.organizationId! },
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

