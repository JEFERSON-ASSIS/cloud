import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type OutboundPolicy = "webhook" | "ssh";

function parseIpv4(ip: string): number[] | null {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return parts;
}

export function isBlockedIpAddress(ip: string, policy: OutboundPolicy): boolean {
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return true;
  if (ip.startsWith("fe80:") || ip.startsWith("FE80:")) return true;
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("FC") || ip.startsWith("FD")) {
    return policy === "webhook";
  }

  const parts = parseIpv4(ip);
  if (!parts) {
    // Endereços IPv6 não classificados: bloqueia em webhook, permite em SSH.
    return policy === "webhook" && ip.includes(":");
  }

  const a = parts[0]!;
  const b = parts[1]!;
  if (a === 0 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 10) return policy === "webhook";
  if (a === 172 && b >= 16 && b <= 31) return policy === "webhook";
  if (a === 192 && b === 168) return policy === "webhook";
  if (a === 100 && b >= 64 && b <= 127) return policy === "webhook"; // CGNAT
  return false;
}

function normalizeHostname(host: string): string {
  const trimmed = host.trim().toLowerCase();
  if (!trimmed) throw new Error("Host inválido.");
  if (trimmed === "localhost" || trimmed.endsWith(".localhost")) {
    throw new Error("Destino local não é permitido.");
  }
  return trimmed.replace(/\.$/, "");
}

export async function assertSafeOutboundHost(
  host: string,
  policy: OutboundPolicy = "webhook",
): Promise<string> {
  const hostname = normalizeHostname(host);

  if (isIP(hostname)) {
    if (isBlockedIpAddress(hostname, policy)) {
      throw new Error(
        policy === "ssh"
          ? "Host SSH bloqueado (loopback, link-local ou metadados)."
          : "Destino em rede privada, loopback ou link-local não é permitido.",
      );
    }
    return hostname;
  }

  let resolved: string;
  try {
    const result = await lookup(hostname, { all: false });
    resolved = result.address;
  } catch {
    throw new Error("Não foi possível resolver o host informado.");
  }

  if (isBlockedIpAddress(resolved, policy)) {
    throw new Error(
      policy === "ssh"
        ? "Host SSH resolve para endereço bloqueado (loopback, link-local ou metadados)."
        : "O host resolve para rede privada, loopback ou link-local.",
    );
  }

  return hostname;
}

export async function assertSafeWebhookUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL de webhook inválida.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Webhooks devem usar HTTPS.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Credenciais embutidas na URL não são permitidas.");
  }

  await assertSafeOutboundHost(parsed.hostname, "webhook");
  return parsed;
}

export async function fetchSafeWebhook(
  rawUrl: string,
  init: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const url = await assertSafeWebhookUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      redirect: "error",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
