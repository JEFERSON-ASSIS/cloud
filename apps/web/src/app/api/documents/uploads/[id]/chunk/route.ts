import {
  getOwnedUploadSession,
  RESUMABLE_CHUNK_SIZE,
  uploadResumableChunk,
} from "@/server/resumable-upload";
import { requireTenantOrganization } from "@/server/tenant";
import { userFacingStorageError } from "@/server/storage-error";

async function readChunk(request: Request): Promise<Uint8Array> {
  if (!request.body) throw new Error("Bloco de upload vazio.");
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > RESUMABLE_CHUNK_SIZE) {
      await reader.cancel();
      throw new Error(`O bloco excede ${RESUMABLE_CHUNK_SIZE} bytes.`);
    }
    parts.push(value);
  }
  if (size === 0) throw new Error("Bloco de upload vazio.");
  const result = new Uint8Array(size);
  let cursor = 0;
  for (const part of parts) {
    result.set(part, cursor);
    cursor += part.byteLength;
  }
  return result;
}

function parseContentRange(value: string | null) {
  const match = value ? /^bytes (\d+)-(\d+)\/(\d+)$/.exec(value) : null;
  if (!match) throw new Error("Cabeçalho Content-Range inválido.");
  return {
    start: Number(match[1]),
    end: Number(match[2]),
    total: Number(match[3]),
  };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let actorRole: string | null | undefined;
  try {
    const declaredLength = Number(request.headers.get("content-length"));
    if (
      !Number.isSafeInteger(declaredLength) ||
      declaredLength <= 0 ||
      declaredLength > RESUMABLE_CHUNK_SIZE
    ) {
      throw new Error(`Content-Length deve ficar entre 1 e ${RESUMABLE_CHUNK_SIZE} bytes.`);
    }
    const range = parseContentRange(request.headers.get("content-range"));
    if (range.end - range.start + 1 !== declaredLength) {
      throw new Error("Content-Length não corresponde ao Content-Range.");
    }
    const { tenant, organizationId } = await requireTenantOrganization(
      "document.read",
      request,
    );
    actorRole = tenant.role;
    const { id } = await params;
    const session = await getOwnedUploadSession(id, tenant, organizationId);
    if (range.total !== Number(session.size)) {
      throw new Error("O tamanho total não corresponde à sessão de upload.");
    }
    const chunk = await readChunk(request);
    if (chunk.byteLength !== declaredLength) {
      throw new Error("O bloco recebido possui tamanho diferente do informado.");
    }
    const result = await uploadResumableChunk({
      session,
      chunk,
      offset: range.start,
    });
    return Response.json({
      uploadedBytes: Number(result.session.bytesUploaded),
      complete: result.complete,
      readyToFinalize: Boolean(result.session.storageFileId),
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "document-upload",
        event: "chunk-failed",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
    );
    return Response.json(
      {
        error: userFacingStorageError(
          error,
          actorRole,
          "Não foi possível enviar uma parte do arquivo ao armazenamento em nuvem.",
        ),
      },
      { status: 400 },
    );
  }
}
