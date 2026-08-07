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
  try {
    const tenant = await requireTenant("document.manage");
    const data = await request.formData();
    const file = data.get("file");
    const folderId = data.get("folderId")?.toString() || null;
    let sectorId = data.get("sectorId")?.toString() || null;
    let storageSpaceId = data.get("storageSpaceId")?.toString() || null;

    if (!(file instanceof File)) throw new Error("Selecione um arquivo.");

    const org = await prisma.organization.findUnique({
      where: { id: tenant.organizationId! },
      select: { storageLimit: true },
    });

    const maxBytes = org?.storageLimit ? Number(org.storageLimit) : Number(process.env.MAX_UPLOAD_SIZE ?? 104_857_600);
    const maxMb = Math.round(maxBytes / 1024 / 1024);

    if (file.size <= 0 || file.size > maxBytes)
      throw new Error(
        `O arquivo excede o limite máximo permitido de ${maxMb} MB.`,
      );

    const name = cleanName(file.name);
    const parent = await assertFolder(tenant.organizationId!, folderId);

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
      const sector = await prisma.sector.findUnique({
        where: { id: sectorId },
      });
      if (sector) {
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
      where: { id: tenant.organizationId! },
    });
    const bytes = Buffer.from(await file.arrayBuffer());
    const checksum = createHash("sha256").update(bytes).digest("hex");

    let driveConnection: any;
    let driveProvider: any;
    let targetDriveFolderId: string;

    if (sectorId) {
      const sectorObj = await prisma.sector.findUnique({ where: { id: sectorId } });
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
    const extension = name.includes(".")
      ? name.split(".").pop()?.toLowerCase()
      : null;
    const document = await prisma.document.create({
      data: {
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
      },
    });
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
        const tenant = await requireTenant("document.manage");
        const { drive } = await ensureDriveRoot(tenant.organizationId!, "");
        await drive.delete(remoteFileId);
      } catch {}
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha no upload." },
      { status: 400 },
    );
  }
}

