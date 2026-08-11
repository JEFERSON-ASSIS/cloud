import { prisma } from "@i7ai/database";
import { z } from "zod";
import { requireTenantOrganization } from "@/server/tenant";
import { assertSectorAccess } from "@/server/sector-access";
import { writeAudit } from "@/server/audit";

const resourceTypeSchema = z.enum(["document", "folder"]);
const createSchema = z.object({
  organizationId: z.string().uuid().optional(),
  resourceType: resourceTypeSchema,
  resourceId: z.string().uuid(),
  targetSectorId: z.string().uuid(),
  targetUserId: z.string().uuid().nullable().optional(),
  permission: z.enum(["VIEW", "DOWNLOAD"]).default("VIEW"),
});

async function getResource(
  organizationId: string,
  resourceType: z.infer<typeof resourceTypeSchema>,
  resourceId: string,
) {
  if (resourceType === "document") {
    const document = await prisma.document.findFirst({
      where: {
        id: resourceId,
        organizationId,
        deletedAt: null,
        status: "AVAILABLE",
      },
      select: { id: true, name: true, sectorId: true },
    });
    if (!document) throw new Error("Documento não encontrado.");
    const sectorId = document.sectorId;
    if (!sectorId) throw new Error("O documento não pertence a uma secretaria.");
    return {
      id: document.id,
      name: document.name,
      sectorId,
      resourceType,
      resourceKey: `DOCUMENT:${document.id}`,
    };
  }

  const folder = await prisma.folder.findFirst({
    where: { id: resourceId, organizationId, deletedAt: null },
    select: { id: true, name: true, sectorId: true },
  });
  if (!folder) throw new Error("Pasta não encontrada.");
  const sectorId = folder.sectorId;
  if (!sectorId) throw new Error("A pasta não pertence a uma secretaria.");
  return {
    id: folder.id,
    name: folder.name,
    sectorId,
    resourceType,
    resourceKey: `FOLDER:${folder.id}`,
  };
}

async function assertCanShare(
  userId: string,
  organizationId: string,
  sectorId: string,
  role: string | null | undefined,
) {
  await assertSectorAccess(userId, organizationId, sectorId, role, "EDITOR");
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = z
      .object({
        resourceType: resourceTypeSchema,
        resourceId: z.string().uuid(),
      })
      .parse({
        resourceType: url.searchParams.get("resourceType"),
        resourceId: url.searchParams.get("resourceId"),
      });
    const { tenant, organizationId } = await requireTenantOrganization(
      "document.read",
      request,
    );
    const resource = await getResource(
      organizationId,
      parsed.resourceType,
      parsed.resourceId,
    );
    await assertCanShare(
      tenant.userId,
      organizationId,
      resource.sectorId,
      tenant.role,
    );

    const [shares, sectors] = await Promise.all([
      prisma.documentShare.findMany({
        where: {
          organizationId,
          resourceKey: resource.resourceKey,
          revokedAt: null,
        },
        include: {
          targetSector: { select: { id: true, name: true } },
          targetUser: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.sector.findMany({
        where: {
          organizationId,
          deletedAt: null,
          id: { not: resource.sectorId },
        },
        include: {
          users: {
            where: {
              role: { not: "NO_ACCESS" },
              user: { status: "ACTIVE", deletedAt: null },
            },
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    return Response.json({
      resource: {
        id: resource.id,
        name: resource.name,
        type: resource.resourceType,
        sourceSectorId: resource.sectorId,
      },
      shares: shares.map((share) => ({
        id: share.id,
        permission: share.permission,
        targetSector: share.targetSector,
        targetUser: share.targetUser,
        createdBy: share.createdBy,
        createdAt: share.createdAt,
      })),
      sectors: sectors.map((sector) => ({
        id: sector.id,
        name: sector.name,
        users: sector.users.map((membership) => membership.user),
      })),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao consultar compartilhamentos." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json());
    const { tenant, organizationId } = await requireTenantOrganization(
      "document.read",
      request,
      body.organizationId,
    );
    const resource = await getResource(
      organizationId,
      body.resourceType,
      body.resourceId,
    );
    await assertCanShare(
      tenant.userId,
      organizationId,
      resource.sectorId,
      tenant.role,
    );
    if (body.targetSectorId === resource.sectorId) {
      throw new Error("Selecione uma secretaria diferente da origem.");
    }

    const targetSector = await prisma.sector.findFirst({
      where: {
        id: body.targetSectorId,
        organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!targetSector) throw new Error("Secretaria de destino não encontrada.");

    const targetUserId = body.targetUserId ?? null;
    if (targetUserId) {
      const membership = await prisma.sectorUser.findFirst({
        where: {
          sectorId: body.targetSectorId,
          userId: targetUserId,
          role: { not: "NO_ACCESS" },
          user: { status: "ACTIVE", deletedAt: null },
        },
        select: { id: true },
      });
      if (!membership) {
        throw new Error("O usuário selecionado não pertence à secretaria de destino.");
      }
    }

    const audienceKey = targetUserId ? `USER:${targetUserId}` : "SECTOR";
    const share = await prisma.documentShare.upsert({
      where: {
        organizationId_resourceKey_targetSectorId_audienceKey: {
          organizationId,
          resourceKey: resource.resourceKey,
          targetSectorId: body.targetSectorId,
          audienceKey,
        },
      },
      create: {
        organizationId,
        resourceKey: resource.resourceKey,
        documentId: body.resourceType === "document" ? resource.id : null,
        folderId: body.resourceType === "folder" ? resource.id : null,
        sourceSectorId: resource.sectorId,
        targetSectorId: body.targetSectorId,
        targetUserId,
        audienceKey,
        permission: body.permission,
        createdById: tenant.userId,
      },
      update: {
        permission: body.permission,
        targetUserId,
        revokedAt: null,
        createdById: tenant.userId,
      },
    });
    await writeAudit({
      organizationId,
      userId: tenant.userId,
      action: "DOCUMENT_SHARE_CREATE",
      resourceType: body.resourceType === "document" ? "Document" : "Folder",
      resourceId: resource.id,
      metadata: {
        shareId: share.id,
        sourceSectorId: resource.sectorId,
        targetSectorId: body.targetSectorId,
        targetUserId,
        permission: body.permission,
      },
    });
    return Response.json({ id: share.id }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao compartilhar item." },
      { status: 400 },
    );
  }
}
