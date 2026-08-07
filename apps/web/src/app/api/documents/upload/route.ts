import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { assertFolder, cleanName } from "@/server/documents";
import { ensureDriveRoot, ensureSectorDriveFolder } from "@/server/google-drive";
import { writeAudit } from "@/server/audit";
import { assertSectorPermission } from "@i7ai/security";

export async function POST(request: Request) {
  let remoteFileId: string | undefined;
  let uploadedDrive: Awaited<ReturnType<typeof ensureDriveRoot>>["drive"] | undefined;
  try {
    const tenant = await requireTenant("document.manage");
    const data = await request.formData();
    const file = data.get("file");
    const folderId = data.get("folderId")?.toString() || null;
    const requestedOrganizationId = data.get("organizationId")?.toString() || null;
    const organizationId = tenant.role === "SUPER_ADMIN" && requestedOrganizationId
      ? requestedOrganizationId
      : tenant.organizationId;
    if (!organizationId) throw new Error("Selecione uma empresa ou prefeitura.");
    let sectorId = data.get("sectorId")?.toString() || null;
    let storageSpaceId = data.get("storageSpaceId")?.toString() || null;

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
    const parent = await assertFolder(organizationId, folderId);

    if (parent) {
      sectorId = parent.sectorId;
      storageSpaceId = parent.storageSpaceId;
    }

    // Validar permissões da secretaria se fornecida
    const isOrgAdminOrSuper = tenant.role === "SUPER_ADMIN" || tenant.role === "ADMIN";
    if (sectorId) {
      const membership = await prisma.sectorUser.findUnique({
        where: {
          sectorId_userId: {
            sectorId,
            userId: tenant.userId,
          },
        },
      });
      assertSectorPermission(membership?.role, "EDITOR", isOrgAdminOrSuper);

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
    }

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const bytes = Buffer.from(await file.arrayBuffer());
    const checksum = createHash("sha256").update(bytes).digest("hex");

    let driveConnection: Awaited<ReturnType<typeof ensureDriveRoot>>["connection"];
    let driveProvider: Awaited<ReturnType<typeof ensureDriveRoot>>["drive"];
    let targetDriveFolderId: string;

    if (sectorId) {
      const sectorObj = await prisma.sector.findFirst({ where: { id: sectorId, organizationId } });
      const sectorDrive = await ensureSectorDriveFolder(
        organization.id,
        organization.name,
        sectorId,
        sectorObj?.name ?? "Secretaria",
      );
      driveConnection = sectorDrive.connection;
      driveProvider = sectorDrive.drive;
      targetDriveFolderId = parent?.storageFolderId ?? sectorDrive.sectorFolderId;
    } else {
      const orgDrive = await ensureDriveRoot(
        organization.id,
        organization.name,
      );
      driveConnection = orgDrive.connection;
      driveProvider = orgDrive.drive;
      targetDriveFolderId = parent?.storageFolderId ?? orgDrive.rootFolderId;
    }

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
        folderId: parent?.id ?? null,
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
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha no upload." },
      { status: 400 },
    );
  }
}
