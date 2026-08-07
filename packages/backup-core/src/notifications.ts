import { prisma } from "@i7ai/database";
import { decryptSecret, fetchSafeWebhook } from "@i7ai/security";

export interface NotificationPayload {
  organizationId: string;
  event: "SUCCESS" | "FAILED";
  sourceName: string;
  runId: string;
  durationMs?: number;
  fileSize?: number;
  errorMessage?: string;
}

export async function sendBackupNotification(payload: NotificationPayload): Promise<{ sentCount: number; errors: string[] }> {
  const { organizationId, event, sourceName, runId, durationMs, fileSize, errorMessage } = payload;
  
  const settings = await prisma.notificationSetting.findMany({
    where: {
      organizationId,
      active: true,
    },
  });

  if (!settings || settings.length === 0) {
    return { sentCount: 0, errors: [] };
  }

  let sentCount = 0;
  const errors: string[] = [];

  for (const setting of settings) {
    // Verificar se o evento se aplica a esta configuração
    const events = setting.events || [];
    if (events.length > 0 && !events.includes("ALL") && !events.includes(event)) {
      continue;
    }

    try {
      let config: Record<string, any> = {};
      if (setting.encryptedConfig && typeof setting.encryptedConfig === "object") {
        const { ciphertext } = setting.encryptedConfig as { ciphertext?: string };
        if (ciphertext) {
          try {
            config = JSON.parse(decryptSecret(ciphertext));
          } catch {
            config = setting.encryptedConfig as Record<string, any>;
          }
        } else {
          config = setting.encryptedConfig as Record<string, any>;
        }
      }

      const channel = setting.channel.toUpperCase();
      const statusText = event === "SUCCESS" ? "SUCESSO ✅" : "FALHA ❌";
      const title = `[i7AI Cloud Manager] Backup ${statusText}: ${sourceName}`;
      const formattedSize = fileSize ? `${(fileSize / (1024 * 1024)).toFixed(2)} MB` : "N/A";
      const formattedDuration = durationMs ? `${(durationMs / 1000).toFixed(1)}s` : "N/A";

      if (channel === "WEBHOOK" || channel === "DISCORD" || channel === "SLACK") {
        const url = config.url || config.webhookUrl;
        if (!url) {
          errors.push(`URL do Webhook não configurada para o canal ${setting.channel}`);
          continue;
        }

        let body: any;
        if (channel === "DISCORD") {
          body = {
            embeds: [
              {
                title,
                color: event === "SUCCESS" ? 0x22c55e : 0xef4444,
                fields: [
                  { name: "Origem", value: sourceName, inline: true },
                  { name: "Status", value: event, inline: true },
                  { name: "Tamanho", value: formattedSize, inline: true },
                  { name: "Duração", value: formattedDuration, inline: true },
                  { name: "Run ID", value: runId, inline: false },
                  ...(errorMessage ? [{ name: "Erro", value: errorMessage, inline: false }] : []),
                ],
                timestamp: new Date().toISOString(),
              },
            ],
          };
        } else if (channel === "SLACK") {
          body = {
            text: `*${title}*\n• *Origem:* ${sourceName}\n• *Status:* ${event}\n• *Tamanho:* ${formattedSize}\n• *Duração:* ${formattedDuration}${errorMessage ? `\n• *Erro:* ${errorMessage}` : ""}`,
          };
        } else {
          // Webhook genérico
          body = {
            title,
            event,
            sourceName,
            runId,
            durationMs,
            fileSize,
            errorMessage,
            timestamp: new Date().toISOString(),
          };
        }

        const res = await fetchSafeWebhook(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const text = await res.text();
          errors.push(`Webhook ${channel} respondeu ${res.status}: ${text.slice(0, 100)}`);
        } else {
          sentCount++;
        }
      } else if (channel === "EMAIL") {
        const targetEmail = config.toEmail || config.email;
        if (!targetEmail) {
          errors.push("E-mail de destino não configurado nas notificações.");
          continue;
        }
        // Se houver webhook de envio de e-mail ou serviço configurado
        const emailWebhook = config.emailWebhookUrl;
        if (emailWebhook) {
          await fetchSafeWebhook(emailWebhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: targetEmail, subject: title, event, sourceName, errorMessage }),
          });
          sentCount++;
        } else {
          console.info(`[Notification] Simulação de envio de e-mail para ${targetEmail}: ${title}`);
          sentCount++;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      errors.push(`Erro ao enviar notificação canal ${setting.channel}: ${msg}`);
    }
  }

  return { sentCount, errors };
}
