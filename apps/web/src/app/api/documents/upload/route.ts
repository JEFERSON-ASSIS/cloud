import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { assertSectorFolderDestination, cleanName } from "@/server/documents";
import { ensureSectorDriveFolder } from "@/server/google-drive";
import { writeAudit } from "@/server/audit";
import { assertSectorPermission } from "@i7ai/security";
import { canManageDocuments } from "@/server/document-access";
import { userFacingStorageError } from "@/server/storage-error";

export async function POST(request: Request) {
  let remoteFileId: string | undefined;
  let uploadedDrive: Awaited<ReturnType<typeof ensureSectorDriveFolder>>["drive"] | undefined;
  let actorRole: string | null | undefined;
  try {
    const contentLength = Number(request.headers.get("content-length"));
    const legacyLimit = 16 * 1024 * 1024;
    if (
      !Number.isSafeInteger(contentLength) ||
      contentLength <= 0 ||
      contentLength > legacyLimit
    ) {
      return Response.json(
        {
          error:
            "Use o upload resumível para arquivos maiores. Esta rota aceita no máximo 16 MB.",
        },
        { status: 413 },
      );
    }
    const tenant = await requireTenant("document.read");
    actorRole = tenant.role;
    const data = await request.formData();
    const file = data.get("file");
    const folderId = data.get("folderId")?.toString() || null;
    const requestedOrganizationId = data.get("organizationId")?.toString() || null;
    const organizationId = tenant.role === "SUPER_ADMIN" && requestedOrganizationId
      ? requestedOrganizationId
      : tenant.organizationId;
    if (!organizationId) throw new Error("Selecione uma empresa ou prefeitura.");
    if (!(file instanceof File)) throw new Error("Selecione um arquivo.");

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { storageLimit: true, maxUploadFileSize: true },
    });

    const maxBytes = org?.maxUploadFileSize ? Number(org.maxUploadFileSize) : Number(process.env.MAX_UPLOAD_SIZE ?? 104_857_600);
    const maxMb = Math.round(maxBytes / 1024 / 1024);

    if (file.size <= 0 || file.size > maxBytes)
      throw new Error(
        `O arquivo excede o limite máximo permitido de ${maxMb} MB.`,
      );

    const organizationUsage = await prisma.document.aggregate({
      where: { organizationId, deletedAt: null, status: "AVAILABLE" },
      _sum: { size: true },
    });
    if ((organizationUsage._sum.size ?? BigInt(0)) + BigInt(file.size) > (org?.storageLimit ?? BigInt(0))) {
      throw new Error("Quota total de armazenamento da empresa excedida.");
    }

    const name = cleanName(file.name);
    const parent = await assertSectorFolderDestination(organizationId, folderId);
    const sectorId = parent.sectorId;
    const storageSpaceId = parent.storageSpaceId;

    // Validar permissões da secretaria se fornecida
    const canMutate = canManageDocuments(tenant);
    const membership = await prisma.sectorUser.findUnique({
      where: {
        sectorId_userId: {
          sectorId,
          userId: tenant.userId,
        },
      },
    });
    assertSectorPermission(membership?.role, "EDITOR", canMutate);

    // Validar quota da secretaria
    const sector = await prisma.sector.findFirst({
      where: { id: sectorId, organizationId, deletedAt: null },
    });
    if (!sector) throw new Error("A secretaria não pertence à empresa selecionada.");
    {
      const docUsage = await prisma.document.aggregate({
        where: {
          sectorId,
          deletedAt: null,
          status: "AVAILABLE",
        },
        _sum: { size: true },
      });
      const currentUsage = docUsage._sum.size || BigInt(0);
      if (currentUsage + BigInt(file.size) > sector.quotaLimit) {
        throw new Error("Quota de armazenamento da secretaria excedida.");
      }
    }

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const bytes = Buffer.from(await file.arrayBuffer());
    const checksum = createHash("sha256").update(bytes).digest("hex");

    const sectorObj = await prisma.sector.findFirst({ where: { id: sectorId, organizationId } });
    const sectorDrive = await ensureSectorDriveFolder(
      organization.id,
      organization.name,
      sectorId,
      sectorObj?.name ?? "Secretaria",
    );
    const driveConnection = sectorDrive.connection;
    const driveProvider = sectorDrive.drive;
    const targetDriveFolderId = parent.storageFolderId ?? sectorDrive.sectorFolderId;

    const stored = await driveProvider.upload(
      Readable.from(bytes),
      name,
      targetDriveFolderId,
      file.type || "application/octet-stream",
    );
    remoteFileId = stored.id;
    uploadedDrive = driveProvider;
    const extension = name.includes(".")
      ? name.split(".").pop()?.toLowerCase()
      : null;
    const document = await prisma.$transaction(async (tx) => {
      const usage = await tx.document.aggregate({
        where: { organizationId, deletedAt: null, status: "AVAILABLE" },
        _sum: { size: true },
      });
      if ((usage._sum.size ?? BigInt(0)) + BigInt(file.size) > organization.storageLimit) {
        throw new Error("Quota total de armazenamento da empresa excedida.");
      }
      return tx.document.create({ data: {
        organizationId: organization.id,
        folderId: parent.id,
        sectorId,
        storageSpaceId,
        uploadedById: tenant.userId,
        storageConnectionId: driveConnection.id,
        storageFileId: stored.id,
        name,
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        extension: extension ?? null,
        size: BigInt(file.size),
        checksumSha256: checksum,
        status: "AVAILABLE",
      } });
    }, { isolationLevel: "Serializable" });
    await writeAudit({
      organizationId: organization.id,
      userId: tenant.userId,
      action: "DOCUMENT_UPLOAD",
      resourceType: "Document",
      resourceId: document.id,
      metadata: { name, size: file.size, checksum },
    });
    return Response.json(
      { ...document, size: document.size.toString() },
      { status: 201 },
    );
  } catch (error) {
    if (remoteFileId) {
      try {
        await uploadedDrive?.delete(remoteFileId);
      } catch {}
    }
    console.error(
      JSON.stringify({
        scope: "document-upload",
        event: "legacy-upload-failed",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
    );
    return Response.json(
      {
        error: userFacingStorageError(
          error,
          actorRole,
          "Não foi possível enviar o arquivo ao armazenamento em nuvem.",
        ),
      },
      { status: 400 },
    );
  }
}
