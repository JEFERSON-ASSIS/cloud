import { prisma } from "@i7ai/database";
import { requireTenant } from "@/server/tenant";
import { driveForOrganization } from "@/server/google-drive";
import { writeAudit } from "@/server/audit";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requireTenant("document.read");
    const { id } = await context.params;
    const document = await prisma.document.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId!,
        deletedAt: null,
        status: "AVAILABLE",
      },
    });
    if (!document)
      return Response.json(
        { error: "Documento não encontrado." },
        { status: 404 },
      );

    // Validação de segurança por Secretaria (Anti-IDOR)
    if (document.sectorId && tenant.role !== "SUPER_ADMIN" && tenant.role !== "ADMIN") {
      const membership = await prisma.sectorUser.findUnique({
        where: {
          sectorId_userId: {
            sectorId: document.sectorId,
            userId: tenant.userId,
          },
        },
      });
      if (!membership || membership.role === "NO_ACCESS") {
        return Response.json(
          { error: "Acesso negado aos documentos desta Secretaria." },
          { status: 403 },
        );
      }
    }
    const { drive } = await driveForOrganization(tenant.organizationId!);
    const stream = await drive.download(document.storageFileId);
    const download = new URL(request.url).searchParams.get("download") === "1";
    await writeAudit({
      organizationId: tenant.organizationId,
      userId: tenant.userId,
      action: download ? "DOCUMENT_DOWNLOAD" : "DOCUMENT_PREVIEW",
      resourceType: "Document",
      resourceId: id,
    });
    return new Response(stream, {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": document.size.toString(),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(document.name)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 400 },
    );
  }
}
