import { NextResponse } from "next/server";
import { prisma } from "@i7ai/database";
import { requireTenantOrganization } from "@/server/tenant";
import { writeAudit } from "@/server/audit";
import { assertSectorAccess } from "@/server/sector-access";
import { z } from "zod";

type Params = Promise<{ id: string }>;

const updateScheduleSchema = z.object({
  name: z.string().min(1).optional(),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timezone: z.string().optional(),
  retentionDaily: z.number().int().min(1).max(365).optional(),
  retentionWeekly: z.number().int().min(0).max(52).optional(),
  retentionMonthly: z.number().int().min(0).max(60).optional(),
  active: z.boolean().optional(),
  sourceIds: z.array(z.string().uuid()).min(1).optional(),
});

export async function GET(request: Request, { params }: { params: Params }) {
  try {
    const { tenant, organizationId } = await requireTenantOrganization(
      "backup.read",
      request,
    );
    const { id } = await params;

    const schedule = await prisma.backupSchedule.findFirst({
      where: { id, organizationId },
      include: {
        sector: { select: { id: true, name: true } },
        sources: {
          include: { source: { select: { id: true, name: true, type: true } } },
        },
        runs: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, status: true, startedAt: true, completedAt: true, durationMs: true, errorMessage: true },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
    }

    await assertSectorAccess(tenant.userId, organizationId, schedule.sectorId, tenant.role, "VIEWER_DOWNLOAD");

    return NextResponse.json({
      ...schedule,
      sectorName: schedule.sector?.name || "Sem Secretaria",
      sources: schedule.sources.map((s) => s.source),
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unauthorized"))
      return NextResponse.json({ error: err.message }, { status: 401 });
    return NextResponse.json({ error: "Erro ao buscar agendamento." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    const body = await request.json();
    const { tenant, organizationId } = await requireTenantOrganization(
      "backup.manage",
      request,
      typeof body?.organizationId === "string" ? body.organizationId : null,
    );
    const { id } = await params;

    const existing = await prisma.backupSchedule.findFirstOrThrow({ where: { id, organizationId } });
    await assertSectorAccess(tenant.userId, organizationId, existing.sectorId, tenant.role, "EDITOR");

    const result = updateScheduleSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || result.error.message }, { status: 400 });
    }

    const { sourceIds, ...rest } = result.data;
    let newSectorId = existing.sectorId;

    if (sourceIds) {
      const sources = await prisma.backupSource.findMany({
        where: { id: { in: sourceIds }, organizationId, deletedAt: null },
      });
      if (sources.length !== sourceIds.length) {
        return NextResponse.json({ error: "Uma ou mais origens fornecidas são inválidas." }, { status: 400 });
      }

      const sectorIds = Array.from(new Set(sources.map((s) => s.sectorId).filter(Boolean)));
      if (sectorIds.length > 1) {
        return NextResponse.json(
          { error: "Todas as origens de um agendamento devem pertencer à mesma Secretaria." },
          { status: 400 }
        );
      }
      newSectorId = sectorIds[0] ?? null;

      if (newSectorId) {
        await assertSectorAccess(tenant.userId, organizationId, newSectorId, tenant.role, "EDITOR");
      }
    }

    const updateData = {
      ...rest,
      sectorId: newSectorId,
      ...(sourceIds
        ? {
            sources: {
              deleteMany: {},
              create: sourceIds.map((sourceId) => ({ sourceId })),
            },
          }
        : {}),
    } as any;

    const schedule = await prisma.backupSchedule.update({
      where: { id },
      data: updateData,
      include: {
        sector: { select: { id: true, name: true } },
        sources: {
          include: { source: { select: { id: true, name: true, type: true } } },
        },
      },
    });

    await writeAudit({
      organizationId,
      userId: tenant.userId,
      action: "SCHEDULE_UPDATE",
      resourceType: "BackupSchedule",
      resourceId: id,
      metadata: { id, sectorId: schedule.sectorId },
    });

    const includedSchedule = schedule as typeof schedule & {
      sources: Array<{ source: { id: string; name: string; type: string } }>;
    };

    return NextResponse.json({
      ...schedule,
      sectorName: schedule.sector?.name || "Sem Secretaria",
      sources: includedSchedule.sources.map((s) => s.source),
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unauthorized"))
      return NextResponse.json({ error: err.message }, { status: 401 });
    return NextResponse.json({ error: "Erro ao atualizar agendamento." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Params }) {
  try {
    const { tenant, organizationId } = await requireTenantOrganization(
      "backup.manage",
      request,
    );
    const { id } = await params;

    const schedule = await prisma.backupSchedule.findFirstOrThrow({ where: { id, organizationId } });
    await assertSectorAccess(tenant.userId, organizationId, schedule.sectorId, tenant.role, "ADMIN");

    await prisma.backupSchedule.delete({ where: { id } });

    await writeAudit({
      organizationId,
      userId: tenant.userId,
      action: "SCHEDULE_DELETE",
      resourceType: "BackupSchedule",
      resourceId: id,
      metadata: { id, sectorId: schedule.sectorId },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unauthorized"))
      return NextResponse.json({ error: err.message }, { status: 401 });
    return NextResponse.json({ error: "Erro ao excluir agendamento." }, { status: 500 });
  }
}
