import { prisma } from "@i7ai/database";
import { requireTenantOrganization } from "@/server/tenant";
import { driveForOrganization } from "@/server/google-drive";
import { writeAudit } from "@/server/audit";
import { assertSectorAccess } from "@/server/sector-access";
import { userFacingStorageError } from "@/server/storage-error";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let actorRole: string | null | undefined;
  try {
    const { tenant, organizationId: requestedOrgId } =
      await requireTenantOrganization("document.read", request);
    actorRole = tenant.role;
    const { id } = await context.params;
    const document = await prisma.document.findFirst({
      where:
        tenant.role === "SUPER_ADMIN"
          ? { id, deletedAt: null, status: "AVAILABLE" }
          : {
              id,
              organizationId: requestedOrgId,
              deletedAt: null,
              status: "AVAILABLE",
            },
    });
    if (!document)
      return Response.json(
        { error: "Documento não encontrado." },
        { status: 404 },
      );

    const organizationId = document.organizationId;
    const download = new URL(request.url).searchParams.get("download") === "1";
    await assertSectorAccess(
      tenant.userId,
      organizationId,
      document.sectorId,
      tenant.role,
      download ? "VIEWER_DOWNLOAD" : "VIEWER_ONLY",
    );

    const { drive } = await driveForOrganization(organizationId);
    const stream = await drive.download(document.storageFileId);
    await writeAudit({
      organizationId,
      userId: tenant.userId,
      action: download ? "DOCUMENT_DOWNLOAD" : "DOCUMENT_PREVIEW",
      resourceType: "Document",
      resourceId: id,
    });
    return new Response(stream, {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": document.size.toString(),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(document.name)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return Response.json(
      { error: userFacingStorageError(error, actorRole, "Não foi possível abrir o documento no armazenamento em nuvem.") },
      { status: 400 },
    );
  }
}
