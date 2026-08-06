import { NextResponse } from "next/server";
import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";

export async function GET() {
  try {
    const tenant = await requireTenant("backup.read");
    const organizationId = tenant.organizationId!;

    const runs = await prisma.backupRun.findMany({
      where: { organizationId },
      include: {
        source: {
          select: { name: true, type: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50, // Limita as 50 execuções mais recentes
    });

    return NextResponse.json(runs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
