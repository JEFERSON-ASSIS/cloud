import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { assertFolder, cleanName } from "@/server/documents";
import { driveForOrganization, ensureDriveRoot } from "@/server/google-drive";
import { writeAudit } from "@/server/audit";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requireTenant("document.manage");
    const { id } = await context.params;
    const document = await prisma.document.findFirst({
      where: { id, organizationId: tenant.organizationId! },
    });
    if (!document)
      return Response.json(
        { error: "Documento não encontrado." },
        { status: 404 },
      );

    if (document.sectorId && tenant.role !== "SUPER_ADMIN" && tenant.role !== "ADMIN") {
      const membership = await prisma.sectorUser.findUnique({
        where: {
          sectorId_userId: {
            sectorId: document.sectorId,
            userId: tenant.userId,
          },
        },
      });
      if (!membership || membership.role === "VIEWER_ONLY" || membership.role === "NO_ACCESS") {
        return Response.json(
          { error: "Permissão insuficiente para alterar documentos desta Secretaria." },
          { status: 403 },
        );
      }
    }
    const body = (await request.json()) as {
      action?: "rename" | "move" | "trash" | "restore";
      name?: string;
      folderId?: string | null;
    };
    const { drive, rootFolderId } = await ensureDriveRoot(
      tenant.organizationId!,
      "Documentos",
    );
    let action = "DOCUMENT_UPDATED";
    if (body.action === "rename") {
      const name = cleanName(body.name ?? "");
      await drive.update(document.storageFileId, { name });
      await prisma.document.update({ where: { id }, data: { name } });
      action = "DOCUMENT_RENAME";
    } else if (body.action === "move") {
      const target = await assertFolder(tenant.organizationId!, body.folderId);
      const current = document.folderId
        ? await prisma.folder.findUnique({ where: { id: document.folderId } })
        : null;
      await drive.update(document.storageFileId, {
        addParent: target?.storageFolderId ?? rootFolderId,
        removeParent: current?.storageFolderId ?? rootFolderId,
      });
      await prisma.document.update({
        where: { id },
        data: { folderId: target?.id ?? null },
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
        tenant.organizationId!,
        document.previousFolderId,
      ).catch(() => null);
      await drive.update(document.storageFileId, { trashed: false });
      await prisma.document.update({
        where: { id },
        data: {
          folderId: previous?.id ?? null,
          previousFolderId: null,
          deletedAt: null,
          status: "AVAILABLE",
        },
      });
      action = "DOCUMENT_RESTORE";
    } else throw new Error("Ação inválida.");
    await writeAudit({
      organizationId: tenant.organizationId,
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
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requireTenant("document.manage");
    const { id } = await context.params;
    const document = await prisma.document.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId!,
        deletedAt: { not: null },
      },
    });
    if (!document)
      return Response.json(
        { error: "Documento não encontrado na lixeira." },
        { status: 404 },
      );
    const { drive } = await driveForOrganization(tenant.organizationId!);
    await drive.delete(document.storageFileId);
    await prisma.document.delete({ where: { id } });
    await writeAudit({
      organizationId: tenant.organizationId,
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
