import { prisma } from "@i7ai/database";
import { driveForOrganization } from "@/server/google-drive";
import {
  getOwnedUploadSession,
  RESUMABLE_CHUNK_SIZE,
  syncResumableUpload,
} from "@/server/resumable-upload";
import { requireTenantOrganization } from "@/server/tenant";
import { userFacingStorageError } from "@/server/storage-error";

export async function GET(
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
    return Response.json({
      uploadId: session.id,
      chunkSize: RESUMABLE_CHUNK_SIZE,
      status: session.status,
      uploadedBytes: Number(session.bytesUploaded),
      size: Number(session.size),
      readyToFinalize: Boolean(session.storageFileId && session.status === "ACTIVE"),
      documentId: session.documentId,
      error: session.errorMessage
        ? userFacingStorageError(new Error(session.errorMessage), actorRole)
        : null,
      expiresAt: session.expiresAt.toISOString(),
    });
  } catch (error) {
    return Response.json(
      {
        error: userFacingStorageError(
          error,
          actorRole,
          "Não foi possível consultar o envio no armazenamento em nuvem.",
        ),
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
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
    const session = await getOwnedUploadSession(id, tenant, organizationId);
    if (session.status === "COMPLETED") {
      throw new Error("O upload concluído deve ser excluído pela tela de arquivos.");
    }
    if (session.storageFileId) {
      const { drive } = await driveForOrganization(session.organizationId);
      await drive.delete(session.storageFileId);
    }
    await prisma.documentUploadSession.update({
      where: { id: session.id },
      data: { status: "CANCELLED", errorMessage: "Upload cancelado pelo usuário." },
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json(
      {
        error: userFacingStorageError(
          error,
          actorRole,
          "Não foi possível cancelar o envio no armazenamento em nuvem.",
        ),
      },
      { status: 400 },
    );
  }
}
