import { prisma } from "@i7ai/database";
import { requireTenantOrganization } from "@/server/tenant";
import { assertFolder, cleanName } from "@/server/documents";
import { driveForOrganization, ensureDriveRoot } from "@/server/google-drive";
import { writeAudit } from "@/server/audit";
import { assertSectorAccess } from "@/server/sector-access";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const body = (await request.json()) as {
      action?: "rename" | "move" | "trash" | "restore";
      name?: string;
      folderId?: string | null;
      organizationId?: string;
    };
    const { tenant, organizationId: requestedOrgId } =
      await requireTenantOrganization("document.read", request, body.organizationId);
    const { id } = await context.params;
    const document = await prisma.document.findFirst({
      where:
        tenant.role === "SUPER_ADMIN"
          ? { id }
          : { id, organizationId: requestedOrgId },
    });
    if (!document)
      return Response.json(
        { error: "Documento não encontrado." },
        { status: 404 },
      );

    const organizationId = document.organizationId;
    const sectorOpts = {
      allowDocumentManage: true,
      permissions: tenant.permissions,
    };
    await assertSectorAccess(
      tenant.userId,
      organizationId,
      document.sectorId,
      tenant.role,
      "EDITOR",
      sectorOpts,
    );

    const { drive, rootFolderId } = await ensureDriveRoot(
      organizationId,
      "Documentos",
    );
    let action = "DOCUMENT_UPDATED";
    if (body.action === "rename") {
      const name = cleanName(body.name ?? "");
      await drive.update(document.storageFileId, { name });
      await prisma.document.update({ where: { id }, data: { name } });
      action = "DOCUMENT_RENAME";
    } else if (body.action === "move") {
      const target = await assertFolder(organizationId, body.folderId);
      if (target?.sectorId && target.sectorId !== document.sectorId) {
        await assertSectorAccess(
          tenant.userId,
          organizationId,
          target.sectorId,
          tenant.role,
          "EDITOR",
          sectorOpts,
        );
      }
      const current = document.folderId
        ? await prisma.folder.findUnique({ where: { id: document.folderId } })
        : null;
      await drive.update(document.storageFileId, {
        addParent: target?.storageFolderId ?? rootFolderId,
        removeParent: current?.storageFolderId ?? rootFolderId,
      });
      await prisma.document.update({
        where: { id },
        data: {
          folderId: target?.id ?? null,
          sectorId: target?.sectorId ?? document.sectorId,
          storageSpaceId: target?.storageSpaceId ?? document.storageSpaceId,
        },
      });
      action = "DOCUMENT_MOVE";
    } else if (body.action === "trash") {
      await drive.update(document.storageFileId, { trashed: true });
      await prisma.document.update({
        where: { id },
        data: {
          previousFolderId: document.folderId,
          deletedAt: new Date(),
          status: "DELETED",
        },
      });
      action = "DOCUMENT_DELETE";
    } else if (body.action === "restore") {
      const previous = await assertFolder(
        organizationId,
        document.previousFolderId,
      ).catch(() => null);
      if (previous?.sectorId) {
        await assertSectorAccess(
          tenant.userId,
          organizationId,
          previous.sectorId,
          tenant.role,
          "EDITOR",
          sectorOpts,
        );
      }
      await drive.update(document.storageFileId, { trashed: false });
      await prisma.document.update({
        where: { id },
        data: {
          folderId: previous?.id ?? null,
          previousFolderId: null,
          deletedAt: null,
          status: "AVAILABLE",
          sectorId: previous?.sectorId ?? document.sectorId,
          storageSpaceId: previous?.storageSpaceId ?? document.storageSpaceId,
        },
      });
      action = "DOCUMENT_RESTORE";
    } else throw new Error("Ação inválida.");
    await writeAudit({
      organizationId,
      userId: tenant.userId,
      action,
      resourceType: "Document",
      resourceId: id,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { tenant, organizationId: requestedOrgId } =
      await requireTenantOrganization("document.read", request);
    const { id } = await context.params;
    const document = await prisma.document.findFirst({
      where:
        tenant.role === "SUPER_ADMIN"
          ? { id, deletedAt: { not: null } }
          : {
              id,
              organizationId: requestedOrgId,
              deletedAt: { not: null },
            },
    });
    if (!document)
      return Response.json(
        { error: "Documento não encontrado na lixeira." },
        { status: 404 },
      );

    const organizationId = document.organizationId;
    await assertSectorAccess(
      tenant.userId,
      organizationId,
      document.sectorId,
      tenant.role,
      "EDITOR",
      { allowDocumentManage: true, permissions: tenant.permissions },
    );

    const { drive } = await driveForOrganization(organizationId);
    await drive.delete(document.storageFileId);
    await prisma.document.delete({ where: { id } });
    await writeAudit({
      organizationId,
      userId: tenant.userId,
      action: "DOCUMENT_DELETE_PERMANENT",
      resourceType: "Document",
      resourceId: id,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 400 },
    );
  }
}
