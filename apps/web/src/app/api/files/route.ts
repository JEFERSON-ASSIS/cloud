import { prisma, type Prisma } from "@i7ai/database";
import { requireTenantOrganization } from "@/server/tenant";
import { folderBreadcrumbs } from "@/server/documents";
import { assertSectorPermission } from "@i7ai/security";
import { canManageDocuments } from "@/server/document-access";
import {
  assertActiveSectorAccess,
  resolveSharedFolderAccess,
  shareRecipientFilter,
  sharedFolderBreadcrumbs,
  tenantIsPrivileged,
} from "@/server/document-shares";

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
    const shared = url.searchParams.get("shared") === "1";
    const allFolders = url.searchParams.get("allFolders") === "1";
    const sectorId = url.searchParams.get("sectorId");
    const storageSpaceId = url.searchParams.get("storageSpaceId");
    const privileged = tenantIsPrivileged(tenant);

    if (!sectorId) throw new Error("Selecione uma secretaria para listar os arquivos.");
    await assertActiveSectorAccess(tenant, organizationId, sectorId);

    if (shared) {
      if (trash) throw new Error("A lixeira não está disponível em compartilhamentos.");
      const recipient = shareRecipientFilter(tenant.userId, privileged);

      if (!folderId) {
        const rawShares = await prisma.documentShare.findMany({
          where: {
            organizationId,
            targetSectorId: sectorId,
            revokedAt: null,
            ...recipient,
            OR: [
              { document: { is: { deletedAt: null, status: "AVAILABLE" } } },
              { folder: { is: { deletedAt: null } } },
            ],
          },
          include: {
            document: { include: { uploadedBy: { select: { name: true } } } },
            folder: { include: { createdBy: { select: { name: true } } } },
            sourceSector: { select: { name: true } },
            createdBy: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        });
        const uniqueShares = new Map<string, (typeof rawShares)[number]>();
        for (const shareItem of rawShares) {
          const existing = uniqueShares.get(shareItem.resourceKey);
          if (!existing || (existing.permission === "VIEW" && shareItem.permission === "DOWNLOAD")) {
            uniqueShares.set(shareItem.resourceKey, shareItem);
          }
        }
        const visibleShares = [...uniqueShares.values()].filter((shareItem) => {
          const name = shareItem.document?.name ?? shareItem.folder?.name ?? "";
          return !search || name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));
        });
        return Response.json({
          breadcrumbs: [{ id: "__shared__", name: "Compartilhados comigo" }],
          isReadOnly: true,
          canDownload: false,
          sharedView: true,
          folders: visibleShares
            .filter((shareItem) => shareItem.folder)
            .map((shareItem) => ({
              ...shareItem.folder,
              kind: "folder",
              shared: true,
              shareId: shareItem.id,
              sourceSectorName: shareItem.sourceSector.name,
              sharedByName: shareItem.createdBy.name,
              canDownload: shareItem.permission === "DOWNLOAD",
            })),
          documents: visibleShares
            .filter((shareItem) => shareItem.document)
            .map((shareItem) => ({
              ...shareItem.document,
              size: shareItem.document!.size.toString(),
              kind: "document",
              shared: true,
              shareId: shareItem.id,
              sourceSectorName: shareItem.sourceSector.name,
              sharedByName: shareItem.createdBy.name,
              canDownload: shareItem.permission === "DOWNLOAD",
            })),
        });
      }

      const grant = await resolveSharedFolderAccess(
        tenant,
        organizationId,
        sectorId,
        folderId,
      );
      const [grantDetails, folders, documents, breadcrumbs] = await Promise.all([
        prisma.documentShare.findUniqueOrThrow({
          where: { id: grant.id },
          include: {
            sourceSector: { select: { name: true } },
            createdBy: { select: { name: true } },
          },
        }),
        prisma.folder.findMany({
          where: {
            organizationId,
            parentId: folderId,
            deletedAt: null,
            ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
          },
          include: { createdBy: { select: { name: true } } },
          orderBy: { name: "asc" },
        }),
        prisma.document.findMany({
          where: {
            organizationId,
            folderId,
            deletedAt: null,
            status: "AVAILABLE",
            ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
          },
          include: { uploadedBy: { select: { name: true } } },
          orderBy: { name: "asc" },
        }),
        sharedFolderBreadcrumbs(organizationId, folderId, grant.folderId!),
      ]);
      const shareMetadata = {
        shared: true,
        shareId: grant.id,
        sourceSectorName: grantDetails.sourceSector.name,
        sharedByName: grantDetails.createdBy.name,
        canDownload: grant.permission === "DOWNLOAD",
      };
      return Response.json({
        breadcrumbs: [
          { id: "__shared__", name: "Compartilhados comigo" },
          ...breadcrumbs,
        ],
        isReadOnly: true,
        canDownload: grant.permission === "DOWNLOAD",
        sharedView: true,
        folders: folders.map((folder) => ({ ...folder, kind: "folder", ...shareMetadata })),
        documents: documents.map((document) => ({
          ...document,
          size: document.size.toString(),
          kind: "document",
          ...shareMetadata,
        })),
      });
    }

    const folderSectorFilter: Prisma.FolderWhereInput = { sectorId };
    const documentSectorFilter: Prisma.DocumentWhereInput = { sectorId };
    const sectorScopeFilter: Prisma.SectorWhereInput = { id: sectorId };

    if (folderId && !trash) {
      const selectedFolder = await prisma.folder.findFirst({
        where: {
          id: folderId,
          organizationId,
          deletedAt: null,
          ...folderSectorFilter,
        },
        select: { id: true },
      });
      if (!selectedFolder) throw new Error("Pasta não encontrada nesta secretaria.");
    }

    let isReadOnly = false;
    let canDownload = true;
    let canShare = privileged;
    if (!privileged) {
      const membership = await prisma.sectorUser.findUnique({
        where: { sectorId_userId: { sectorId, userId: tenant.userId } },
      });
      assertSectorPermission(membership?.role, "VIEWER_ONLY", false);
      const canMutate = canManageDocuments(tenant);
      isReadOnly = !canMutate && membership?.role !== "EDITOR" && membership?.role !== "ADMIN";
      canDownload =
        canMutate ||
        membership?.role === "VIEWER_DOWNLOAD" ||
        membership?.role === "EDITOR" ||
        membership?.role === "ADMIN";
      canShare = membership?.role === "EDITOR" || membership?.role === "ADMIN";
    }

    if (!allFolders && !folderId && !trash && !search) {
      const sectorsForOrg = await prisma.sector.findMany({
        where: { organizationId, deletedAt: null, ...sectorScopeFilter },
        include: { storageSpaces: { where: { deletedAt: null } } },
      });
      for (const sector of sectorsForOrg) {
        const existingFolder = await prisma.folder.findFirst({
          where: { organizationId, sectorId: sector.id, parentId: null },
        });
        if (!existingFolder) {
          const space = sector.storageSpaces[0];
          await prisma.folder.create({
            data: {
              organizationId,
              sectorId: sector.id,
              storageSpaceId: space?.id || null,
              name: sector.name,
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
          ...folderSectorFilter,
          ...(storageSpaceId ? { storageSpaceId } : {}),
          ...(allFolders
            ? { deletedAt: null, storageFolderId: { not: null } }
            : trash
              ? { deletedAt: { not: null } }
              : { parentId: folderId, deletedAt: null }),
          ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
        },
        include: { createdBy: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.document.findMany({
        where: {
          organizationId,
          ...documentSectorFilter,
          ...(storageSpaceId ? { storageSpaceId } : {}),
          ...(trash
            ? { deletedAt: { not: null } }
            : { folderId, deletedAt: null, status: "AVAILABLE" }),
          ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
        },
        include: { uploadedBy: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
      trash ? [] : folderBreadcrumbs(organizationId, folderId),
    ]);

    const resourceKeys = [
      ...folders.map((folder) => `FOLDER:${folder.id}`),
      ...documents.map((document) => `DOCUMENT:${document.id}`),
    ];
    const activeShares = resourceKeys.length
      ? await prisma.documentShare.findMany({
          where: { organizationId, resourceKey: { in: resourceKeys }, revokedAt: null },
          select: { resourceKey: true },
        })
      : [];
    const shareCounts = activeShares.reduce<Record<string, number>>((counts, shareItem) => {
      counts[shareItem.resourceKey] = (counts[shareItem.resourceKey] ?? 0) + 1;
      return counts;
    }, {});

    let hasIncomingShares = false;
    if (!allFolders && !folderId && !trash && sectorId) {
      hasIncomingShares = Boolean(
        await prisma.documentShare.findFirst({
          where: {
            organizationId,
            targetSectorId: sectorId,
            revokedAt: null,
            ...shareRecipientFilter(tenant.userId, privileged),
            OR: [
              { document: { is: { deletedAt: null, status: "AVAILABLE" } } },
              { folder: { is: { deletedAt: null } } },
            ],
          },
          select: { id: true },
        }),
      );
    }

    return Response.json({
      breadcrumbs,
      isReadOnly,
      canDownload,
      canShare,
      sharedView: false,
      folders: [
        ...(hasIncomingShares
          ? [
              {
                id: "__shared__",
                name: "Compartilhados comigo",
                updatedAt: new Date(),
                kind: "folder",
                virtual: true,
                shared: true,
                canDownload: false,
              },
            ]
          : []),
        ...folders.map((folder) => ({
          ...folder,
          kind: "folder",
          shareCount: shareCounts[`FOLDER:${folder.id}`] ?? 0,
        })),
      ],
      documents: documents.map((document) => ({
        ...document,
        size: document.size.toString(),
        kind: "document",
        shareCount: shareCounts[`DOCUMENT:${document.id}`] ?? 0,
      })),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 400 },
    );
  }
}
