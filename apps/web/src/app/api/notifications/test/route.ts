import { NextResponse } from "next/server";
import { requireTenant } from "@/server/tenant";
import { sendBackupNotification } from "@i7ai/backup-core";

export async function POST() {
  try {
    const tenant = await requireTenant("organization.manage");

    const result = await sendBackupNotification({
      organizationId: tenant.organizationId!,
      event: "SUCCESS",
      sourceName: "Servidor de Teste (Manual)",
      runId: "test-run-" + Date.now(),
      durationMs: 1230,
      fileSize: 1024 * 1024 * 5, // 5MB
    });

    if (result.errors.length > 0 && result.sentCount === 0) {
      return NextResponse.json({ error: result.errors.join("; ") }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      sentCount: result.sentCount,
      warnings: result.errors,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao testar notificação";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
