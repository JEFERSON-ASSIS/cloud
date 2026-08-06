import { NextResponse } from "next/server";
import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant("backup.read");
    const organizationId = tenant.organizationId!;

    const { searchParams } = new URL(request.url);
    const level = searchParams.get("level");
    const runId = searchParams.get("runId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {
      backupRun: { organizationId },
    };

    if (level) where.level = level;
    if (runId) where.backupRunId = runId;

    const [logs, total] = await Promise.all([
      prisma.backupLog.findMany({
        where: where as any,
        include: {
          backupRun: {
            select: {
              id: true,
              source: { select: { name: true, type: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.backupLog.count({ where: where as any }),
    ]);

    return NextResponse.json({ logs, total, limit, offset });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unauthorized"))
      return NextResponse.json({ error: err.message }, { status: 401 });
    return NextResponse.json({ error: "Erro ao buscar logs." }, { status: 500 });
  }
}
