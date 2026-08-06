import { NextResponse } from "next/server";
import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { writeAudit } from "@/server/audit";
import { z } from "zod";

const createScheduleSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido (HH:MM)"),
  timezone: z.string().default("America/Cuiaba"),
  retentionDaily: z.number().int().min(1).max(365).default(7),
  retentionWeekly: z.number().int().min(0).max(52).default(4),
  retentionMonthly: z.number().int().min(0).max(60).default(6),
  sourceIds: z.array(z.string().uuid()).min(1, "Selecione ao menos uma origem"),
});

export async function GET() {
  try {
    const tenant = await requireTenant("backup.read");
    const organizationId = tenant.organizationId!;

    const schedules = await prisma.backupSchedule.findMany({
      where: { organizationId },
      include: {
        sources: {
          include: {
            source: { select: { id: true, name: true, type: true } },
          },
        },
        runs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, startedAt: true, completedAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      schedules.map((s) => ({
        ...s,
        sources: s.sources.map((ss) => ss.source),
        lastRun: s.runs[0] ?? null,
      }))
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unauthorized"))
      return NextResponse.json({ error: err.message }, { status: 401 });
    return NextResponse.json({ error: "Erro ao listar agendamentos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant("backup.manage");
    const organizationId = tenant.organizationId!;

    const body = await request.json();
    const result = createScheduleSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || result.error.message }, { status: 400 });
    }

    const { name, frequency, time, timezone, retentionDaily, retentionWeekly, retentionMonthly, sourceIds } = result.data;

    // Verificar que todas as fontes pertencem à organização
    const sources = await prisma.backupSource.findMany({
      where: { id: { in: sourceIds }, organizationId, deletedAt: null },
    });
    if (sources.length !== sourceIds.length) {
      return NextResponse.json({ error: "Uma ou mais origens de backup são inválidas." }, { status: 400 });
    }

    const schedule = await prisma.backupSchedule.create({
      data: {
        organizationId,
        name,
        frequency,
        time,
        timezone,
        retentionDaily,
        retentionWeekly,
        retentionMonthly,
        sources: {
          create: sourceIds.map((sourceId) => ({ sourceId })),
        },
      },
      include: {
        sources: {
          include: { source: { select: { id: true, name: true, type: true } } },
        },
      },
    });

    await writeAudit({
      organizationId,
      userId: tenant.userId,
      action: "SCHEDULE_CREATE",
      resourceType: "BackupSchedule",
      resourceId: schedule.id,
    });

    return NextResponse.json({ ...schedule, sources: schedule.sources.map((s) => s.source) }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unauthorized"))
      return NextResponse.json({ error: err.message }, { status: 401 });
    return NextResponse.json({ error: "Erro ao criar agendamento." }, { status: 500 });
  }
}
