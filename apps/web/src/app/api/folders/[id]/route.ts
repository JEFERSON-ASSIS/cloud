import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { assertFolder, cleanName, isDescendant } from "@/server/documents";
import { ensureDriveRoot } from "@/server/google-drive";
import { writeAudit } from "@/server/audit";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requireTenant("document.manage");
    const { id } = await context.params;
    const folder = await prisma.folder.findFirst({
      where: tenant.role === "SUPER_ADMIN"
        ? { id }
        : { id, organizationId: tenant.organizationId! },
    });
    if (!folder)
      return Response.json({ error: "Pasta não encontrada." }, { status: 404 });

    const organizationId = folder.organizationId;
    const body = (await request.json()) as {
      action?: "rename" | "move" | "trash" | "restore";
      name?: string;
      parentId?: string | null;
    };
    const { drive } = await ensureDriveRoot(
      organizationId,
      "Documentos",
    );
    let action = "FOLDER_UPDATED";
    if (body.action === "rename") {
      const name = cleanName(body.name ?? "");
      if (folder.storageFolderId) {
        try {
          await drive.update(folder.storageFolderId, { name });
        } catch {}
      }
      await prisma.folder.update({ where: { id }, data: { name } });
      action = "FOLDER_RENAME";
    } else if (body.action === "move") {
      const target = await assertFolder(organizationId, body.parentId);
      if (target && (await isDescendant(organizationId, target.id, id)))
        throw new Error(
          "Uma pasta não pode ser movida para dentro dela mesma.",
        );
      const current = folder.parentId
        ? await prisma.folder.findUnique({ where: { id: folder.parentId } })
        : null;
      if (folder.storageFolderId) {
        try {
          const updatePayload: { addParent?: string; removeParent?: string } = {};
          if (target?.storageFolderId) updatePayload.addParent = target.storageFolderId;
          if (current?.storageFolderId) updatePayload.removeParent = current.storageFolderId;
          if (Object.keys(updatePayload).length > 0) {
            await drive.update(folder.storageFolderId, updatePayload);
          }
        } catch {}
      }
      await prisma.folder.update({
        where: { id },
        data: {
          parentId: target?.id ?? null,
          sectorId: target?.sectorId ?? folder.sectorId,
          storageSpaceId: target?.storageSpaceId ?? folder.storageSpaceId,
        },
      });
      action = "FOLDER_MOVE";
    } else if (body.action === "trash") {
      if (folder.storageFolderId) {
        try {
          await drive.update(folder.storageFolderId, { trashed: true });
        } catch {}
      }
      await prisma.folder.update({
        where: { id },
        data: { previousParentId: folder.parentId, deletedAt: new Date() },
      });
      action = "FOLDER_DELETE";
    } else if (body.action === "restore") {
      const previous = await assertFolder(
        organizationId,
        folder.previousParentId,
      ).catch(() => null);
      if (folder.storageFolderId) {
        try {
          await drive.update(folder.storageFolderId, { trashed: false });
        } catch {}
      }
      await prisma.folder.update({
        where: { id },
        data: {
          parentId: previous?.id ?? null,
          previousParentId: null,
          deletedAt: null,
        },
      });
      action = "FOLDER_RESTORE";
    } else throw new Error("Ação inválida.");

    await writeAudit({
      organizationId,
      userId: tenant.userId,
      action,
      resourceType: "Folder",
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
