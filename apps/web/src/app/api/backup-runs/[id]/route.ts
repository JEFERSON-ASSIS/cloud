import { NextResponse } from "next/server";
import { prisma } from "@i7ai/database";
import { requireTenantOrganization } from "@/server/tenant";

type Params = Promise<{ id: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
  try {
    const { organizationId } = await requireTenantOrganization(
      "backup.read",
      request,
    );
    const { id } = await params;

    const run = await prisma.backupRun.findFirstOrThrow({
      where: { id, organizationId },
      include: {
        source: {
          select: { name: true, type: true },
        },
        logs: {
          orderBy: { createdAt: "asc" },
        },
        files: {
          select: { id: true, name: true, size: true, verifiedAt: true },
        },
      },
    });

    const sanitizedFiles = run.files.map((f) => ({
      ...f,
      size: f.size.toString(),
    }));

    return NextResponse.json({
      ...run,
      files: sanitizedFiles,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Params }) {
  try {
    const { organizationId } = await requireTenantOrganization(
      "backup.manage",
      request,
    );
    const { id } = await params;

    await prisma.backupRun.deleteMany({
      where: { id, organizationId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
