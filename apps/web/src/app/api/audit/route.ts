import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant("audit.read");
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || undefined;
    const user = url.searchParams.get("user") || undefined;
    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId: tenant.organizationId!,
        ...(action
          ? { action: { contains: action, mode: "insensitive" } }
          : {}),
        ...(user
          ? { user: { name: { contains: user, mode: "insensitive" } } }
          : {}),
      },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return Response.json(logs);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 403 },
    );
  }
}
