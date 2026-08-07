import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { subDays } from "date-fns";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant("dashboard.read");
    const url = new URL(request.url);
    const paramOrgId = url.searchParams.get("organizationId");

    const organizationId =
      tenant.role === "SUPER_ADMIN" && paramOrgId
        ? paramOrgId
        : tenant.organizationId!;

    const since = subDays(new Date(), 29);
    const isPrivileged = tenant.role === "SUPER_ADMIN" || tenant.role === "ADMIN";

    const userSectorIds = isPrivileged
      ? []
      : (
          await prisma.sectorUser.findMany({
            where: { userId: tenant.userId },
            select: { sectorId: true },
          })
        ).map((s) => s.sectorId);

    const documentWhere = isPrivileged
      ? { organizationId, deletedAt: null }
      : { organizationId, deletedAt: null, sectorId: { in: userSectorIds } };

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
    ] = await Promise.all([
      prisma.document.findMany({
        where: documentWhere,
        select: { size: true },
      }),
      prisma.backupFile.aggregate({
        where: { backupRun: { organizationId } },
        _sum: { size: true },
      }),
      prisma.backupRun.count({
        where: { organizationId, status: "COMPLETED" },
      }),
      prisma.backupRun.count({
        where: { organizationId, status: "FAILED" },
      }),
      prisma.organizationUser.count({
        where: { organizationId },
      }),
      prisma.storageConnection.count({
        where: { organizationId, status: "CONNECTED", deletedAt: null },
      }),
      prisma.auditLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { user: { select: { name: true } } },
      }),
      prisma.auditLog.groupBy({
        by: ["createdAt"],
        where: {
          organizationId,
          createdAt: { gte: since },
        },
        _count: true,
      }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { storageLimit: true, name: true },
      }),
    ]);

    const totalDocSize = documents.reduce((acc, d) => acc + d.size, BigInt(0));
    const totalBackupSize = backupRunAgg._sum.size ?? BigInt(0);
    const totalUsedBytes = totalDocSize + totalBackupSize;

    const storageLimitBytes = organization?.storageLimit ?? BigInt(107374182400); // 100 GB default
    const usedPercentage =
      storageLimitBytes > BigInt(0)
        ? (Number(totalUsedBytes) / Number(storageLimitBytes)) * 100
        : 0;

    return Response.json({
      organizationName: organization?.name ?? "Empresa",
      totalDocuments: documents.length,
      usedBytes: totalUsedBytes.toString(),
      usedGB: (Number(totalUsedBytes) / 1073741824).toFixed(2),
      storageLimitGB: (Number(storageLimitBytes) / 1073741824).toFixed(1),
      usedPercentage: usedPercentage.toFixed(1),
      backupSuccessCount,
      backupFailedCount,
      activeUsersCount,
      activeIntegrationsCount,
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
      { error: error instanceof Error ? error.message : "Erro ao carregar estatísticas do painel." },
      { status: 500 }
    );
  }
}
