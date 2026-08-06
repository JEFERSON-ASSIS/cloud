import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { folderBreadcrumbs } from "@/server/documents";
import { assertSectorPermission } from "@i7ai/security";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant("document.read");
    const url = new URL(request.url);
    const folderId = url.searchParams.get("folderId");
    const search = url.searchParams.get("search")?.trim();
    const trash = url.searchParams.get("trash") === "1";
    const allFolders = url.searchParams.get("allFolders") === "1";
    const sectorId = url.searchParams.get("sectorId");
    const storageSpaceId = url.searchParams.get("storageSpaceId");
    const organizationId = tenant.organizationId!;

    let isReadOnly = false;

    if (sectorId) {
      const isOrgAdminOrSuper = tenant.role === "SUPER_ADMIN" || tenant.role === "ADMIN";
      const membership = await prisma.sectorUser.findUnique({
        where: {
          sectorId_userId: {
            sectorId,
            userId: tenant.userId,
          },
        },
      });
      
      assertSectorPermission(membership?.role, "VIEWER_ONLY", isOrgAdminOrSuper);
      
      if (membership?.role === "VIEWER_ONLY" && !isOrgAdminOrSuper) {
        isReadOnly = true;
      }
    }

    const [folders, documents, breadcrumbs] = await Promise.all([
      prisma.folder.findMany({
        where: {
          organizationId,
          ...(sectorId ? { sectorId } : {}),
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
          ...(sectorId ? { sectorId } : {}),
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

