import { prisma, type Prisma } from "@i7ai/database";
import { headers } from "next/headers";

export async function writeAudit(input: {
  organizationId?: string | null;
  userId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const requestHeaders = await headers();
  const forwarded = requestHeaders
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  await prisma.auditLog.create({
    data: {
      ...input,
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      ip: forwarded ?? requestHeaders.get("x-real-ip"),
      userAgent: requestHeaders.get("user-agent"),
    },
  });
}
