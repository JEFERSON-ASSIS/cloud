import { writeAudit } from "@/server/audit";
import {
  finalizeResumableUpload,
  getOwnedUploadSession,
  syncResumableUpload,
} from "@/server/resumable-upload";
import { requireTenantOrganization } from "@/server/tenant";
import { userFacingStorageError } from "@/server/storage-error";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let actorRole: string | null | undefined;
  try {
    const { tenant, organizationId } = await requireTenantOrganization(
      "document.read",
      request,
    );
    actorRole = tenant.role;
    const { id } = await params;
    let session = await getOwnedUploadSession(id, tenant, organizationId);
    if (session.status === "ACTIVE" && !session.storageFileId) {
      session = await syncResumableUpload(session);
    }
    const document = await finalizeResumableUpload(session);
    await writeAudit({
      organizationId: document.organizationId,
      userId: tenant.userId,
      action: "DOCUMENT_UPLOAD",
      resourceType: "Document",
      resourceId: document.id,
      metadata: {
        name: document.name,
        size: document.size.toString(),
        checksum: document.checksumSha256,
        uploadMode: "resumable",
      },
    });
    return Response.json(
      { ...document, size: document.size.toString() },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      {
        error: userFacingStorageError(
          error,
          actorRole,
          "Não foi possível finalizar o envio no armazenamento em nuvem.",
        ),
      },
      { status: 400 },
    );
  }
}
