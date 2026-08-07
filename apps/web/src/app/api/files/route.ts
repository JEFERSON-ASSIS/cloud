import { prisma } from "@i7ai/database";
import { requireTenantOrganization } from "@/server/tenant";
import { folderBreadcrumbs } from "@/server/documents";
import { assertSectorPermission } from "@i7ai/security";
import { canManageDocuments } from "@/server/document-access";

export async function GET(request: Request) {
  try {
    const { tenant, organizationId } = await requireTenantOrganization(
      "document.read",
      request,
    );
    const url = new URL(request.url);
    const folderId = url.searchParams.get("folderId");
    const search = url.searchParams.get("search")?.trim();
    const trash = url.searchParams.get("trash") === "1";
    const allFolders = url.searchParams.get("allFolders") === "1";
    const sectorId = url.searchParams.get("sectorId");
    const storageSpaceId = url.searchParams.get("storageSpaceId");

    const isPrivileged = tenant.role === "SUPER_ADMIN" || tenant.role === "ADMIN";
    const canMutate = canManageDocuments(tenant);
    let isReadOnly = false;
    let canDownload = true;

    let userSectorIds: string[] = [];
    if (!isPrivileged) {
      const userSectors = await prisma.sectorUser.findMany({
        where: { userId: tenant.userId },
        select: { sectorId: true },
      });
      userSectorIds = userSectors.map((s) => s.sectorId);
    }

    if (sectorId) {
      const membership = await prisma.sectorUser.findUnique({
        where: {
          sectorId_userId: {
            sectorId,
            userId: tenant.userId,
          },
        },
      });
      
      assertSectorPermission(membership?.role, "VIEWER_ONLY", isPrivileged);
      
      if (!isPrivileged) {
        const role = membership?.role;
        isReadOnly =
          !canMutate && role !== "EDITOR" && role !== "ADMIN";
        canDownload =
          canMutate ||
          role === "VIEWER_DOWNLOAD" ||
          role === "EDITOR" ||
          role === "ADMIN";
      }
    }

    const sectorFilter = sectorId
      ? { sectorId }
      : !isPrivileged
      ? { sectorId: { in: userSectorIds } }
      : {};

    // Sincronizar pastas das secretarias da organizacao para aparecerem na raiz de /arquivos e /pastas
    if (!folderId && !trash && !search) {
      const sectorsForOrg = await prisma.sector.findMany({
        where: { organizationId, deletedAt: null },
        include: { storageSpaces: { where: { deletedAt: null } } },
      });

      for (const sec of sectorsForOrg) {
        const existingFolder = await prisma.folder.findFirst({
          where: { organizationId, sectorId: sec.id, parentId: null },
        });
        if (!existingFolder) {
          const space = sec.storageSpaces[0];
          await prisma.folder.create({
            data: {
              organizationId,
              sectorId: sec.id,
              storageSpaceId: space?.id || null,
              name: sec.name,
              storageFolderId: space?.rootFolderId || null,
              createdById: tenant.userId,
              parentId: null,
            },
          });
        }
      }
    }

    const [folders, documents, breadcrumbs] = await Promise.all([
      prisma.folder.findMany({
        where: {
          organizationId,
          ...sectorFilter,
          ...(storageSpaceId ? { storageSpaceId } : {}),
          ...(allFolders
            ? { deletedAt: null }
            : trash
              ? { deletedAt: { not: null } }
              : { parentId: folderId, deletedAt: null }),
          ...(search
            ? { name: { contains: search, mode: "insensitive" } }
            : {}),
        },
        include: { createdBy: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.document.findMany({
        where: {
          organizationId,
          ...sectorFilter,
          ...(storageSpaceId ? { storageSpaceId } : {}),
          ...(trash
            ? { deletedAt: { not: null } }
            : { folderId, deletedAt: null, status: "AVAILABLE" }),
          ...(search
            ? { name: { contains: search, mode: "insensitive" } }
            : {}),
        },
        include: { uploadedBy: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
      trash ? [] : folderBreadcrumbs(organizationId, folderId),
    ]);
    return Response.json({
      breadcrumbs,
      isReadOnly,
      canDownload,
      folders: folders.map((f) => ({ ...f, kind: "folder" })),
      documents: documents.map((d) => ({
        ...d,
        size: d.size.toString(),
        kind: "document",
      })),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 400 },
    );
  }
}

