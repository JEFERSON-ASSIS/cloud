import { NextResponse } from "next/server";
import { prisma } from "@i7ai/database";
import { requireTenantOrganization } from "@/server/tenant";
import { S3StorageProvider } from "@i7ai/storage";

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireTenantOrganization(
      "integration.manage",
      request,
    );
    const connection = await prisma.storageConnection.findFirst({
      where: {
        organizationId,
        provider: "S3",
        deletedAt: null,
      },
    });

    if (!connection) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      id: connection.id,
      name: connection.name,
      status: connection.status,
      updatedAt: connection.updatedAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar integração S3";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { organizationId } = await requireTenantOrganization(
      "integration.manage",
      req,
      typeof body?.organizationId === "string" ? body.organizationId : null,
    );
    const { name, endpoint, region, bucket, accessKeyId, secretAccessKey, provider = "S3" } = body;

    if (!bucket || !accessKeyId || !secretAccessKey) {
      return NextResponse.json(
        { error: "Campos obrigatórios: Bucket, Access Key ID e Secret Access Key." },
        { status: 400 }
      );
    }

    // Testar conexão S3 antes de salvar
    const s3 = new S3StorageProvider({
      endpoint,
      region,
      bucket,
      accessKeyId,
      secretAccessKey,
    });

    await s3.testConnection();

    // Salvar ou atualizar StorageConnection
    const connection = await prisma.storageConnection.upsert({
      where: {
        id: body.id || "00000000-0000-0000-0000-000000000000",
      },
      create: {
        organizationId,
        provider: provider === "MINIO" ? "MINIO" : provider === "BACKBLAZE_B2" ? "BACKBLAZE_B2" : "S3",
        name: name || `Armazenamento ${provider}`,
        status: "CONNECTED",
      },
      update: {
        name: name || `Armazenamento ${provider}`,
        status: "CONNECTED",
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      message: "Conexão S3/MinIO salva e testada com sucesso!",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao conectar S3";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { organizationId } = await requireTenantOrganization(
      "integration.manage",
      request,
    );
    await prisma.storageConnection.updateMany({
      where: {
        organizationId,
        provider: { in: ["S3", "MINIO", "BACKBLAZE_B2"] },
      },
      data: {
        deletedAt: new Date(),
        status: "DISCONNECTED",
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao desconectar S3";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
