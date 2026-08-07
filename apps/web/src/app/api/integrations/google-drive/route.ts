import { prisma } from "@i7ai/database";
import { requireTenantOrganization } from "@/server/tenant";
import { driveForOrganization } from "@/server/google-drive";
import { writeAudit } from "@/server/audit";

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireTenantOrganization(
      "document.read",
      request,
    );
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
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 403 },
    );
  }
}

export async function PATCH(request: Request) {
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
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId } = await requireTenantOrganization(
      "integration.manage",
      request,
    );
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
      { error: error instanceof Error ? error.message : "Erro de conexão." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { tenant, organizationId } = await requireTenantOrganization(
      "integration.manage",
      request,
    );
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
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 400 },
    );
  }
}
