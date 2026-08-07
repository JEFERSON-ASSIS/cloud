import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant("audit.read");
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || undefined;
    const user = url.searchParams.get("user") || undefined;
    const organizationIdParam = url.searchParams.get("organizationId") || undefined;

    const whereClause: any = {};

    if (tenant.role === "SUPER_ADMIN") {
      if (organizationIdParam) {
        whereClause.organizationId = organizationIdParam;
      }
    } else {
      whereClause.organizationId = tenant.organizationId!;
    }

    if (action) {
      whereClause.action = { contains: action, mode: "insensitive" };
    }
    if (user) {
      whereClause.user = { name: { contains: user, mode: "insensitive" } };
    }

    const logs = await prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: { select: { name: true, email: true } },
        organization: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return Response.json(logs);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 403 }
    );
  }
}
