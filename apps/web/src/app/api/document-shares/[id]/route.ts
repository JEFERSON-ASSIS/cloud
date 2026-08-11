import { prisma } from "@i7ai/database";
import { requireTenantOrganization } from "@/server/tenant";
import { assertSectorAccess } from "@/server/sector-access";
import { writeAudit } from "@/server/audit";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { tenant, organizationId } = await requireTenantOrganization(
      "document.read",
      request,
    );
    const { id } = await context.params;
    const share = await prisma.documentShare.findFirst({
      where: { id, organizationId, revokedAt: null },
    });
    if (!share) {
      return Response.json({ error: "Compartilhamento não encontrado." }, { status: 404 });
    }
    await assertSectorAccess(
      tenant.userId,
      organizationId,
      share.sourceSectorId,
      tenant.role,
      "EDITOR",
    );
    await prisma.documentShare.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    await writeAudit({
      organizationId,
      userId: tenant.userId,
      action: "DOCUMENT_SHARE_REVOKE",
      resourceType: share.documentId ? "Document" : "Folder",
      ...((share.documentId ?? share.folderId)
        ? { resourceId: (share.documentId ?? share.folderId)! }
        : {}),
      metadata: {
        shareId: share.id,
        targetSectorId: share.targetSectorId,
        targetUserId: share.targetUserId,
      },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao revogar compartilhamento." },
      { status: 400 },
    );
  }
}
