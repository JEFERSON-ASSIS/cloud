import { createHash } from "node:crypto";
import { prisma, type DocumentUploadSession, type Prisma } from "@i7ai/database";
import { assertSectorPermission } from "@i7ai/security";
import type { TenantSession } from "@i7ai/types";
import { canManageDocuments } from "@/server/document-access";
import { assertFolder, cleanName } from "@/server/documents";
import {
  driveForOrganization,
  ensureDriveRoot,
  ensureSectorDriveFolder,
} from "@/server/google-drive";
import { decryptSecret, encryptSecret } from "@/server/encryption";

export const RESUMABLE_CHUNK_SIZE = 8 * 1024 * 1024;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const RESERVED_STATUSES = ["ACTIVE", "FINALIZING"] as const;

type StartUploadInput = {
  organizationId: string;
  folderId?: string | null;
  sectorId?: string | null;
  storageSpaceId?: string | null;
  name: string;
  mimeType?: string | null;
  size: number;
};

function uploadLog(
  event: string,
  fields: Record<string, string | number | boolean | null | undefined>,
) {
  console.info(JSON.stringify({ scope: "document-upload", event, ...fields }));
}

export async function expireUploadSessions() {
  await prisma.documentUploadSession.updateMany({
    where: {
      status: { in: [...RESERVED_STATUSES] },
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED", errorMessage: "Sessão de upload expirada." },
  });
}

async function assertAvailableQuota(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    sectorId: string | null;
    size: bigint;
    excludeSessionId?: string;
  },
) {
  const [organization, documentUsage, reservedUsage] = await Promise.all([
    tx.organization.findUnique({
      where: { id: input.organizationId },
      select: { storageLimit: true },
    }),
    tx.document.aggregate({
      where: {
        organizationId: input.organizationId,
        deletedAt: null,
        status: "AVAILABLE",
      },
      _sum: { size: true },
    }),
    tx.documentUploadSession.aggregate({
      where: {
        organizationId: input.organizationId,
        status: { in: [...RESERVED_STATUSES] },
        expiresAt: { gt: new Date() },
        ...(input.excludeSessionId ? { id: { not: input.excludeSessionId } } : {}),
      },
      _sum: { size: true },
    }),
  ]);
  if (!organization) throw new Error("Empresa não encontrada.");
  const total =
    (documentUsage._sum.size ?? 0n) +
    (reservedUsage._sum.size ?? 0n) +
    input.size;
  if (total > organization.storageLimit) {
    throw new Error("Quota total de armazenamento da empresa excedida.");
  }

  if (!input.sectorId) return;
  const [sector, sectorDocuments, sectorReserved] = await Promise.all([
    tx.sector.findFirst({
      where: {
        id: input.sectorId,
        organizationId: input.organizationId,
        deletedAt: null,
      },
      select: { quotaLimit: true },
    }),
    tx.document.aggregate({
      where: {
        sectorId: input.sectorId,
        deletedAt: null,
        status: "AVAILABLE",
      },
      _sum: { size: true },
    }),
    tx.documentUploadSession.aggregate({
      where: {
        sectorId: input.sectorId,
        status: { in: [...RESERVED_STATUSES] },
        expiresAt: { gt: new Date() },
        ...(input.excludeSessionId ? { id: { not: input.excludeSessionId } } : {}),
      },
      _sum: { size: true },
    }),
  ]);
  if (!sector) throw new Error("A secretaria não pertence à empresa selecionada.");
  const sectorTotal =
    (sectorDocuments._sum.size ?? 0n) +
    (sectorReserved._sum.size ?? 0n) +
    input.size;
  if (sectorTotal > sector.quotaLimit) {
    throw new Error("Quota de armazenamento da secretaria excedida.");
  }
}

export async function startResumableUpload(
  tenant: TenantSession,
  input: StartUploadInput,
) {
  if (!Number.isSafeInteger(input.size) || input.size <= 0) {
    throw new Error("Tamanho de arquivo inválido.");
  }
  await expireUploadSessions();
  const organization = await prisma.organization.findFirst({
    where: { id: input.organizationId, status: "ACTIVE", deletedAt: null },
    select: { id: true, name: true, maxUploadFileSize: true },
  });
  if (!organization) throw new Error("Empresa não encontrada.");
  if (BigInt(input.size) > organization.maxUploadFileSize) {
    const maxMb = Math.round(Number(organization.maxUploadFileSize) / 1024 / 1024);
    throw new Error(`O arquivo excede o limite máximo permitido de ${maxMb} MB.`);
  }

  const name = cleanName(input.name);
  const parent = await assertFolder(input.organizationId, input.folderId);
  let sectorId = parent?.sectorId ?? input.sectorId ?? null;
  let storageSpaceId = parent?.storageSpaceId ?? input.storageSpaceId ?? null;

  if (sectorId) {
    const membership = await prisma.sectorUser.findUnique({
      where: { sectorId_userId: { sectorId, userId: tenant.userId } },
    });
    assertSectorPermission(
      membership?.role,
      "EDITOR",
      canManageDocuments(tenant),
    );
    const sector = await prisma.sector.findFirst({
      where: { id: sectorId, organizationId: input.organizationId, deletedAt: null },
      select: { name: true },
    });
    if (!sector) throw new Error("A secretaria não pertence à empresa selecionada.");
    const target = await ensureSectorDriveFolder(
      input.organizationId,
      organization.name,
      sectorId,
      sector.name,
    );
    const targetFolderId = parent?.storageFolderId ?? target.sectorFolderId;
    const uri = await target.drive.startResumableUpload(
      name,
      input.size,
      targetFolderId,
      input.mimeType || "application/octet-stream",
    );
    const session = await prisma.$transaction(
      async (tx) => {
        await assertAvailableQuota(tx, {
          organizationId: input.organizationId,
          sectorId,
          size: BigInt(input.size),
        });
        return tx.documentUploadSession.create({
          data: {
            organizationId: input.organizationId,
            userId: tenant.userId,
            folderId: parent?.id ?? null,
            sectorId,
            storageSpaceId,
            storageConnectionId: target.connection.id,
            name,
            originalName: input.name,
            mimeType: input.mimeType || "application/octet-stream",
            size: BigInt(input.size),
            encryptedResumableUri: encryptSecret(uri),
            expiresAt: new Date(Date.now() + SESSION_TTL_MS),
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
    uploadLog("started", {
      uploadId: session.id,
      organizationId: session.organizationId,
      userId: session.userId,
      size: input.size,
      sectorId,
    });
    return session;
  }

  sectorId = null;
  storageSpaceId = null;
  const target = await ensureDriveRoot(input.organizationId, organization.name);
  const targetFolderId = parent?.storageFolderId ?? target.rootFolderId;
  const uri = await target.drive.startResumableUpload(
    name,
    input.size,
    targetFolderId,
    input.mimeType || "application/octet-stream",
  );
  const session = await prisma.$transaction(
    async (tx) => {
      await assertAvailableQuota(tx, {
        organizationId: input.organizationId,
        sectorId,
        size: BigInt(input.size),
      });
      return tx.documentUploadSession.create({
        data: {
          organizationId: input.organizationId,
          userId: tenant.userId,
          folderId: parent?.id ?? null,
          sectorId,
          storageSpaceId,
          storageConnectionId: target.connection.id,
          name,
          originalName: input.name,
          mimeType: input.mimeType || "application/octet-stream",
          size: BigInt(input.size),
          encryptedResumableUri: encryptSecret(uri),
          expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
  uploadLog("started", {
    uploadId: session.id,
    organizationId: session.organizationId,
    userId: session.userId,
    size: input.size,
    sectorId: null,
  });
  return session;
}

export async function getOwnedUploadSession(
  uploadId: string,
  tenant: TenantSession,
  organizationId: string,
): Promise<DocumentUploadSession> {
  const session = await prisma.documentUploadSession.findFirst({
    where: {
      id: uploadId,
      organizationId,
      ...(tenant.role === "SUPER_ADMIN" ? {} : { userId: tenant.userId }),
    },
  });
  if (!session) throw new Error("Sessão de upload não encontrada.");
  if (session.expiresAt.getTime() <= Date.now() && session.status === "ACTIVE") {
    return prisma.documentUploadSession.update({
      where: { id: session.id },
      data: { status: "EXPIRED", errorMessage: "Sessão de upload expirada." },
    });
  }
  return session;
}

export async function syncResumableUpload(session: DocumentUploadSession) {
  if (session.status !== "ACTIVE") return session;
  const { drive } = await driveForOrganization(session.organizationId);
  const progress = await drive.getResumableUploadStatus(
    decryptSecret(session.encryptedResumableUri),
    Number(session.size),
  );
  return prisma.documentUploadSession.update({
    where: { id: session.id },
    data: {
      bytesUploaded: BigInt(progress.uploadedBytes),
      ...(progress.object?.id ? { storageFileId: progress.object.id } : {}),
      errorMessage: null,
    },
  });
}

export async function uploadResumableChunk(input: {
  session: DocumentUploadSession;
  chunk: Uint8Array;
  offset: number;
}) {
  if (input.session.status !== "ACTIVE") {
    throw new Error("Esta sessão de upload não está ativa.");
  }
  if (input.offset !== Number(input.session.bytesUploaded)) {
    throw new Error(`Bloco fora de sequência. Continue a partir do byte ${input.session.bytesUploaded}.`);
  }
  if (
    input.chunk.byteLength > RESUMABLE_CHUNK_SIZE ||
    input.chunk.byteLength <= 0
  ) {
    throw new Error(`Cada bloco deve ter no máximo ${RESUMABLE_CHUNK_SIZE} bytes.`);
  }
  const { drive } = await driveForOrganization(input.session.organizationId);
  const result = await drive.uploadResumableChunk(
    decryptSecret(input.session.encryptedResumableUri),
    input.chunk,
    input.offset,
    Number(input.session.size),
    input.session.mimeType,
  );
  const updated = await prisma.documentUploadSession.update({
    where: { id: input.session.id },
    data: {
      bytesUploaded: BigInt(result.uploadedBytes),
      ...(result.object?.id ? { storageFileId: result.object.id } : {}),
      errorMessage: null,
    },
  });
  uploadLog("chunk-confirmed", {
    uploadId: updated.id,
    bytesUploaded: result.uploadedBytes,
    complete: result.complete,
  });
  return { session: updated, complete: result.complete };
}

async function sha256FromDrive(organizationId: string, storageFileId: string) {
  const { drive } = await driveForOrganization(organizationId);
  const stream = await drive.download(storageFileId);
  const hash = createHash("sha256");
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    hash.update(value);
  }
  return hash.digest("hex");
}

export async function finalizeResumableUpload(session: DocumentUploadSession) {
  if (session.status === "COMPLETED" && session.documentId) {
    return prisma.document.findUniqueOrThrow({ where: { id: session.documentId } });
  }
  if (session.status !== "ACTIVE" || !session.storageFileId) {
    throw new Error("O armazenamento em nuvem ainda não confirmou o arquivo completo.");
  }
  const claimed = await prisma.documentUploadSession.updateMany({
    where: { id: session.id, status: "ACTIVE", storageFileId: { not: null } },
    data: { status: "FINALIZING", errorMessage: null },
  });
  if (claimed.count !== 1) throw new Error("O upload já está sendo finalizado.");

  const startedAt = Date.now();
  try {
    const { drive } = await driveForOrganization(session.organizationId);
    const metadata = await drive.getMetadata(session.storageFileId);
    if (metadata.size !== Number(session.size)) {
      await drive.delete(session.storageFileId);
      await prisma.documentUploadSession.update({
        where: { id: session.id },
        data: {
          status: "FAILED",
          errorMessage: "O tamanho confirmado pelo armazenamento em nuvem é diferente do arquivo original.",
        },
      });
      throw new Error("Falha na integridade: tamanho armazenado diferente do arquivo original.");
    }
    const checksumSha256 = await sha256FromDrive(
      session.organizationId,
      session.storageFileId,
    );
    const extension = session.name.includes(".")
      ? session.name.split(".").pop()?.toLowerCase() ?? null
      : null;
    const document = await prisma.$transaction(
      async (tx) => {
        await assertAvailableQuota(tx, {
          organizationId: session.organizationId,
          sectorId: session.sectorId,
          size: session.size,
          excludeSessionId: session.id,
        });
        const created = await tx.document.create({
          data: {
            organizationId: session.organizationId,
            folderId: session.folderId,
            sectorId: session.sectorId,
            storageSpaceId: session.storageSpaceId,
            uploadedById: session.userId,
            storageConnectionId: session.storageConnectionId,
            storageFileId: session.storageFileId!,
            name: session.name,
            originalName: session.originalName,
            mimeType: session.mimeType,
            extension,
            size: session.size,
            checksumSha256,
            status: "AVAILABLE",
          },
        });
        await tx.documentUploadSession.update({
          where: { id: session.id },
          data: {
            documentId: created.id,
            bytesUploaded: session.size,
            status: "COMPLETED",
            completedAt: new Date(),
            errorMessage: null,
          },
        });
        return created;
      },
      { isolationLevel: "Serializable" },
    );
    uploadLog("completed", {
      uploadId: session.id,
      documentId: document.id,
      size: Number(session.size),
      durationMs: Date.now() - startedAt,
    });
    return document;
  } catch (error) {
    await prisma.documentUploadSession.updateMany({
      where: { id: session.id, status: "FINALIZING" },
      data: {
        status: "ACTIVE",
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Falha na finalização.",
      },
    });
    console.error(
      JSON.stringify({
        scope: "document-upload",
        event: "finalize-failed",
        uploadId: session.id,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
    );
    throw error;
  }
}
