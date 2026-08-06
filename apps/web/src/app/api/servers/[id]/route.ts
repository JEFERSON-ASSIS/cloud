import { NextResponse } from "next/server";
import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { encryptSecret } from "@/server/encryption";
import { writeAudit } from "@/server/audit";
import { z } from "zod";

const updateServerSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").optional(),
  host: z.string().min(1, "Host é obrigatório").optional(),
  port: z.number().int().optional(),
  username: z.string().min(1, "Usuário é obrigatório").optional(),
  authenticationType: z.enum(["PASSWORD", "KEY"]).optional(),
  password: z.string().nullable().optional(),
  privateKey: z.string().nullable().optional(),
});

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    const tenant = await requireTenant("backup.manage");
    const organizationId = tenant.organizationId!;
    const { id } = await params;

    // Verificar se o servidor existe e pertence à organização
    await prisma.server.findFirstOrThrow({
      where: { id, organizationId, deletedAt: null },
    });

    const body = await request.json();
    const result = updateServerSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || result.error.message }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (result.data.name !== undefined) data.name = result.data.name;
    if (result.data.host !== undefined) data.host = result.data.host;
    if (result.data.port !== undefined) data.port = result.data.port;
    if (result.data.username !== undefined) data.username = result.data.username;
    if (result.data.authenticationType !== undefined) data.authenticationType = result.data.authenticationType;

    if (result.data.password) {
      data.encryptedPassword = encryptSecret(result.data.password);
    } else if (result.data.password === null) {
      data.encryptedPassword = null;
    }

    if (result.data.privateKey) {
      data.encryptedPrivateKey = encryptSecret(result.data.privateKey);
    } else if (result.data.privateKey === null) {
      data.encryptedPrivateKey = null;
    }

    const updated = await prisma.server.update({
      where: { id },
      data,
    });

    await writeAudit({
      organizationId,
      userId: tenant.userId,
      action: "SERVER_UPDATE",
      resourceType: "SERVER",
      resourceId: id,
      metadata: { id, name: updated.name },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      host: updated.host,
      port: updated.port,
      username: updated.username,
      authenticationType: updated.authenticationType,
      status: updated.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Params }) {
  try {
    const tenant = await requireTenant("backup.manage");
    const organizationId = tenant.organizationId!;
    const { id } = await params;

    // Verificar pertencimento
    const server = await prisma.server.findFirstOrThrow({
      where: { id, organizationId, deletedAt: null },
    });

    await prisma.server.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await writeAudit({
      organizationId,
      userId: tenant.userId,
      action: "SERVER_DELETE",
      resourceType: "SERVER",
      resourceId: id,
      metadata: { id, name: server.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
