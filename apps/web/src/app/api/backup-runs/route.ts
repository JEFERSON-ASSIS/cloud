import { NextResponse } from "next/server";
import { prisma } from "@i7ai/database";
import { requireTenantOrganization } from "@/server/tenant";
import { getUserSectorIds } from "@/server/sector-access";

export async function GET(request: Request) {
  try {
    const { tenant, organizationId } = await requireTenantOrganization(
      "backup.read",
      request,
    );
    const allowedSectorIds = await getUserSectorIds(tenant.userId, organizationId, tenant.role);

    const whereClause: any = { organizationId };
    if (allowedSectorIds !== null) {
      whereClause.OR = [
        { sectorId: { in: allowedSectorIds } },
        { sectorId: null },
      ];
    }

    const runs = await prisma.backupRun.findMany({
      where: whereClause,
      include: {
        sector: { select: { id: true, name: true } },
        source: {
          select: { name: true, type: true, sectorId: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(
      runs.map((r) => ({
        ...r,
        sectorName: r.sector?.name || "Sem Secretaria",
      }))
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
