import { createHmac, timingSafeEqual } from "node:crypto";

type State = { organizationId: string; userId: string; expiresAt: number };
const secret = () => process.env.AUTH_SECRET ?? "";

export function createOAuthState(state: State) {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyOAuthState(value: string): State {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) throw new Error("Estado OAuth inválido.");
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  )
    throw new Error("Estado OAuth inválido.");
  const parsed = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8"),
  ) as State;
  if (parsed.expiresAt < Date.now())
    throw new Error("A autorização expirou. Tente novamente.");
  return parsed;
}
