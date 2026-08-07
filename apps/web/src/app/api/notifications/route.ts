import { NextResponse } from "next/server";
import { prisma } from "@i7ai/database";
import { requireTenantOrganization } from "@/server/tenant";
import { encryptSecret, decryptSecret, assertSafeWebhookUrl } from "@i7ai/security";

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireTenantOrganization(
      "organization.read",
      request,
    );
    const settings = await prisma.notificationSetting.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });

    const decrypted = settings.map((s: { id: string; channel: string; active: boolean; events: string[]; encryptedConfig: any; createdAt: Date }) => {
      let config: Record<string, any> = {};
      if (s.encryptedConfig && typeof s.encryptedConfig === "object") {
        const { ciphertext } = s.encryptedConfig as { ciphertext?: string };
        if (ciphertext) {
          try {
            config = JSON.parse(decryptSecret(ciphertext));
          } catch {
            config = {};
          }
        } else {
          config = s.encryptedConfig;
        }
      }
      return {
        id: s.id,
        channel: s.channel,
        active: s.active,
        events: s.events,
        config,
        createdAt: s.createdAt,
      };
    });

    return NextResponse.json(decrypted);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar notificações";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { organizationId } = await requireTenantOrganization(
      "organization.manage",
      req,
      typeof body?.organizationId === "string" ? body.organizationId : null,
    );
    const { channel, config, events, active } = body;

    if (!channel) {
      return NextResponse.json({ error: "Canal é obrigatório (DISCORD, SLACK, WEBHOOK ou EMAIL)." }, { status: 400 });
    }

    const channelName = String(channel).toUpperCase();
    const configRecord = (config || {}) as Record<string, unknown>;
    if (channelName === "WEBHOOK" || channelName === "DISCORD" || channelName === "SLACK") {
      const url = configRecord.url || configRecord.webhookUrl;
      if (typeof url !== "string" || !url.trim()) {
        return NextResponse.json({ error: "URL do webhook é obrigatória." }, { status: 400 });
      }
      await assertSafeWebhookUrl(url);
    }
    if (channelName === "EMAIL" && typeof configRecord.emailWebhookUrl === "string" && configRecord.emailWebhookUrl) {
      await assertSafeWebhookUrl(configRecord.emailWebhookUrl);
    }

    const encryptedConfig = {
      ciphertext: encryptSecret(JSON.stringify(config || {})),
    };

    const setting = await prisma.notificationSetting.upsert({
      where: {
        organizationId_channel: {
          organizationId,
          channel,
        },
      },
      create: {
        organizationId,
        channel,
        events: events || ["ALL"],
        active: active ?? true,
        encryptedConfig,
      },
      update: {
        events: events || ["ALL"],
        active: active ?? true,
        encryptedConfig,
      },
    });

    return NextResponse.json(setting);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao salvar notificação";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { organizationId } = await requireTenantOrganization(
      "organization.manage",
      req,
    );
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
    }

    await prisma.notificationSetting.delete({
      where: {
        id,
        organizationId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao remover notificação";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
