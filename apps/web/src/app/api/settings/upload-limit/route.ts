import { prisma } from "@i7ai/database";
import { requireTenantOrganization } from "@/server/tenant";

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireTenantOrganization(
      "organization.read",
      request,
    );
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { maxUploadFileSize: true },
    });
    const mb = Math.round(Number(org.maxUploadFileSize) / 1024 / 1024);
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
    const body = await request.json();
    const { organizationId } = await requireTenantOrganization(
      "organization.manage",
      request,
      typeof body?.organizationId === "string" ? body.organizationId : null,
    );
    const maxUploadSizeMB = Number(body.maxUploadSizeMB);

    if (!maxUploadSizeMB || maxUploadSizeMB <= 0 || maxUploadSizeMB > 5000) {
      return Response.json(
        { error: "Informe um limite válido entre 1 MB e 5000 MB (5 GB)." },
        { status: 400 }
      );
    }

    const bytes = BigInt(maxUploadSizeMB) * BigInt(1024 * 1024);

    await prisma.organization.update({
      where: { id: organizationId },
      data: { maxUploadFileSize: bytes },
    });

    return Response.json({ success: true, maxUploadSizeMB });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar limites." },
      { status: 400 }
    );
  }
}
