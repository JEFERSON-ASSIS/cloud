import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";

export async function GET() {
  try {
    const tenant = await requireTenant("organization.read");
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: tenant.organizationId! },
      select: { storageLimit: true },
    });
    // Converter storageLimit (BigInt em bytes) para MB
    const mb = Math.round(Number(org.storageLimit) / 1024 / 1024);
    return Response.json({ maxUploadSizeMB: mb || 100 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao carregar configurações." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const tenant = await requireTenant("organization.manage");
    const body = await request.json();
    const maxUploadSizeMB = Number(body.maxUploadSizeMB);

    if (!maxUploadSizeMB || maxUploadSizeMB <= 0 || maxUploadSizeMB > 5000) {
      return Response.json(
        { error: "Informe um limite válido entre 1 MB e 5000 MB (5 GB)." },
        { status: 400 }
      );
    }

    const bytes = BigInt(maxUploadSizeMB) * BigInt(1024 * 1024);

    await prisma.organization.update({
      where: { id: tenant.organizationId! },
      data: { storageLimit: bytes },
    });

    return Response.json({ success: true, maxUploadSizeMB });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar limites." },
      { status: 400 }
    );
  }
}
