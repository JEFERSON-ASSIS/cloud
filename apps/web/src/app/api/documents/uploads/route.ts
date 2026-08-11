import { requireTenantOrganization } from "@/server/tenant";
import {
  RESUMABLE_CHUNK_SIZE,
  startResumableUpload,
} from "@/server/resumable-upload";
import { userFacingStorageError } from "@/server/storage-error";

export async function POST(request: Request) {
  let actorRole: string | null | undefined;
  try {
    const body = (await request.json()) as {
      organizationId?: string | null;
      folderId?: string | null;
      sectorId?: string | null;
      storageSpaceId?: string | null;
      name?: string;
      mimeType?: string | null;
      size?: number;
    };
    const { tenant, organizationId } = await requireTenantOrganization(
      "document.read",
      request,
      body.organizationId,
    );
    actorRole = tenant.role;
    if (typeof body.name !== "string" || typeof body.size !== "number") {
      throw new Error("Informe nome e tamanho do arquivo.");
    }
    const session = await startResumableUpload(tenant, {
      organizationId,
      folderId: body.folderId ?? null,
      sectorId: body.sectorId ?? null,
      storageSpaceId: body.storageSpaceId ?? null,
      name: body.name,
      mimeType: body.mimeType ?? null,
      size: body.size,
    });
    return Response.json(
      {
        uploadId: session.id,
        chunkSize: RESUMABLE_CHUNK_SIZE,
        uploadedBytes: Number(session.bytesUploaded),
        expiresAt: session.expiresAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "document-upload",
        event: "start-failed",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
    );
    return Response.json(
      {
        error: userFacingStorageError(
          error,
          actorRole,
          "Não foi possível iniciar o envio ao armazenamento em nuvem.",
        ),
      },
      { status: 400 },
    );
  }
}
