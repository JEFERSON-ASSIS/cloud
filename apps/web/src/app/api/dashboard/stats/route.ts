import { prisma } from "@i7ai/database";
import { requireTenantOrganization } from "@/server/tenant";
import { assertSectorAccess, getUserSectorIds } from "@/server/sector-access";
import { subDays } from "date-fns";

export async function GET(request: Request) {
  try {
    const { tenant, organizationId } = await requireTenantOrganization(
      "dashboard.read",
      request,
    );

    const since = subDays(new Date(), 29);
    const isSuperAdmin = tenant.role === "SUPER_ADMIN";
    const requestedSectorId = new URL(request.url).searchParams.get("sectorId");
    let sectorId: string | null = null;

    if (!isSuperAdmin) {
      if (requestedSectorId) {
        await assertSectorAccess(
          tenant.userId,
          organizationId,
          requestedSectorId,
          tenant.role,
          "VIEWER_ONLY",
        );
        sectorId = requestedSectorId;
      } else {
        const allowedSectorIds = await getUserSectorIds(
          tenant.userId,
          organizationId,
          tenant.role,
        );
        const firstSector = await prisma.sector.findFirst({
          where: {
            organizationId,
            deletedAt: null,
            ...(allowedSectorIds === null
              ? {}
              : { id: { in: allowedSectorIds } }),
          },
          orderBy: { name: "asc" },
          select: { id: true },
        });
        sectorId = firstSector?.id ?? null;
      }
    }

    const documentWhere = {
      organizationId,
      deletedAt: null,
      ...(!isSuperAdmin &&
        (sectorId ? { sectorId } : { id: { in: [] as string[] } })),
    };
    const backupWhere = {
      organizationId,
      ...(!isSuperAdmin &&
        (sectorId ? { sectorId } : { id: { in: [] as string[] } })),
    };

    const [
      documents,
      backupRunAgg,
      backupSuccessCount,
      backupFailedCount,
      activeUsersCount,
      activeIntegrationsCount,
      recentLogs,
      dailyActivities,
      organization,
      sector,
    ] = await Promise.all([
      prisma.document.findMany({
        where: documentWhere,
        select: { size: true },
      }),
      prisma.backupFile.aggregate({
        where: { backupRun: backupWhere },
        _sum: { size: true },
      }),
      prisma.backupRun.count({
        where: { ...backupWhere, status: "COMPLETED" },
      }),
      prisma.backupRun.count({
        where: { ...backupWhere, status: "FAILED" },
      }),
      prisma.organizationUser.count({
        where: {
          organizationId,
          ...(!isSuperAdmin && { userId: tenant.userId }),
        },
      }),
      prisma.storageConnection.count({
        where: { organizationId, status: "CONNECTED", deletedAt: null },
      }),
      prisma.auditLog.findMany({
        where: {
          organizationId,
          ...(!isSuperAdmin && { userId: tenant.userId }),
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { user: { select: { name: true } } },
      }),
      prisma.auditLog.groupBy({
        by: ["createdAt"],
        where: {
          organizationId,
          ...(!isSuperAdmin && { userId: tenant.userId }),
          createdAt: { gte: since },
        },
        _count: true,
      }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { storageLimit: true, name: true },
      }),
      !isSuperAdmin && sectorId
        ? prisma.sector.findFirst({
            where: { id: sectorId, organizationId, deletedAt: null },
            select: { quotaLimit: true },
          })
        : Promise.resolve(null),
    ]);

    const totalDocSize = documents.reduce((acc, d) => acc + d.size, BigInt(0));
    const totalBackupSize = backupRunAgg._sum.size ?? BigInt(0);
    const totalUsedBytes = totalDocSize + totalBackupSize;

    const storageLimitBytes = isSuperAdmin
      ? (organization?.storageLimit ?? BigInt(107374182400))
      : (sector?.quotaLimit ?? BigInt(0));
    const usedPercentage =
      storageLimitBytes > BigInt(0)
        ? (Number(totalUsedBytes) / Number(storageLimitBytes)) * 100
        : 0;

    return Response.json({
      organizationName: organization?.name ?? "Empresa",
      isSuperAdmin,
      sectorId,
      totalDocuments: documents.length,
      usedBytes: totalUsedBytes.toString(),
      usedGB: (Number(totalUsedBytes) / 1073741824).toFixed(2),
      storageLimitGB: (Number(storageLimitBytes) / 1073741824).toFixed(1),
      usedPercentage: usedPercentage.toFixed(1),
      backupSuccessCount: isSuperAdmin ? backupSuccessCount : null,
      backupFailedCount: isSuperAdmin ? backupFailedCount : null,
      activeUsersCount: isSuperAdmin ? activeUsersCount : null,
      activeIntegrationsCount: isSuperAdmin ? activeIntegrationsCount : null,
      recentLogs: recentLogs.map((log) => ({
        id: log.id,
        action: log.action,
        userName: log.user?.name ?? "Sistema",
        createdAt: log.createdAt.toISOString(),
      })),
      dailyActivitiesCount: dailyActivities.length,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao carregar estatísticas do painel.",
      },
      { status: 500 },
    );
  }
}
