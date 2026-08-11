import { prisma } from "@i7ai/database";
import { requireTenantOrganization } from "@/server/tenant";
import { driveForOrganization } from "@/server/google-drive";
import { writeAudit } from "@/server/audit";
import { userFacingStorageError } from "@/server/storage-error";

export async function GET(request: Request) {
  let actorRole: string | null | undefined;
  try {
    const { tenant, organizationId } = await requireTenantOrganization(
      "document.read",
      request,
    );
    actorRole = tenant.role;
    if (new URL(request.url).searchParams.get("folders") === "1") {
      const { drive } = await driveForOrganization(organizationId);
      const folders = (await drive.list("root")).filter(
        (item) => item.mimeType === "application/vnd.google-apps.folder",
      );
      return Response.json(folders);
    }
    const connection = await prisma.storageConnection.findFirst({
      where: {
        organizationId,
        provider: "GOOGLE_DRIVE",
        deletedAt: null,
      },
      include: { googleDrive: true },
    });
    return Response.json(
      connection
        ? {
            id: connection.id,
            status: connection.status,
            accountEmail: connection.googleDrive?.accountEmail,
            lastTestedAt: connection.googleDrive?.lastTestedAt,
            quotaUsed: connection.googleDrive?.quotaUsed?.toString(),
            quotaLimit: connection.googleDrive?.quotaLimit?.toString(),
            rootFolderId: connection.googleDrive?.rootFolderId,
          }
        : null,
    );
  } catch (error) {
    return Response.json(
      { error: userFacingStorageError(error, actorRole) },
      { status: 403 },
    );
  }
}

export async function PATCH(request: Request) {
  let actorRole: string | null | undefined;
  try {
    const body = (await request.json()) as {
      rootFolderId?: string;
      organizationId?: string;
    };
    const { tenant, organizationId } = await requireTenantOrganization(
      "integration.manage",
      request,
      typeof body?.organizationId === "string" ? body.organizationId : null,
    );
    actorRole = tenant.role;
    const { rootFolderId } = body;
    if (!rootFolderId) throw new Error("Selecione uma pasta.");
    const { connection, drive } = await driveForOrganization(organizationId);
    const metadata = await drive.getMetadata(rootFolderId);
    if (metadata.mimeType !== "application/vnd.google-apps.folder")
      throw new Error("O item selecionado não é uma pasta.");
    await prisma.googleDriveConnection.update({
      where: { id: connection.googleDrive!.id },
      data: { rootFolderId },
    });
    await writeAudit({
      organizationId,
      userId: tenant.userId,
      action: "STORAGE_ROOT_CHANGED",
      resourceType: "StorageConnection",
      resourceId: connection.id,
      metadata: { rootFolderId },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: userFacingStorageError(error, actorRole) },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  let actorRole: string | null | undefined;
  try {
    const { tenant, organizationId } = await requireTenantOrganization(
      "integration.manage",
      request,
    );
    actorRole = tenant.role;
    const { connection, drive } = await driveForOrganization(organizationId);
    await drive.testConnection();
    const quota = await drive.getQuota();
    await prisma.googleDriveConnection.update({
      where: { id: connection.googleDrive!.id },
      data: {
        lastTestedAt: new Date(),
        quotaUsed: BigInt(quota.used),
        quotaLimit: quota.limit === null ? null : BigInt(quota.limit),
      },
    });
    return Response.json({ ok: true, quota });
  } catch (error) {
    return Response.json(
      { error: userFacingStorageError(error, actorRole, "Não foi possível testar a conexão com o armazenamento em nuvem.") },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  let actorRole: string | null | undefined;
  try {
    const { tenant, organizationId } = await requireTenantOrganization(
      "integration.manage",
      request,
    );
    actorRole = tenant.role;
    const connection = await prisma.storageConnection.findFirst({
      where: {
        organizationId,
        provider: "GOOGLE_DRIVE",
        deletedAt: null,
      },
    });
    if (connection) {
      await prisma.$transaction([
        prisma.googleDriveConnection.deleteMany({
          where: { storageConnectionId: connection.id },
        }),
        prisma.storageConnection.update({
          where: { id: connection.id },
          data: { status: "DISCONNECTED", deletedAt: new Date() },
        }),
      ]);
      await writeAudit({
        organizationId,
        userId: tenant.userId,
        action: "STORAGE_DISCONNECTED",
        resourceType: "StorageConnection",
        resourceId: connection.id,
      });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: userFacingStorageError(error, actorRole) },
      { status: 400 },
    );
  }
}
