import { prisma } from "@i7ai/database";
import { AuthorizationError } from "@i7ai/security";

export async function assertSectorAccess(
  userId: string | null | undefined,
  organizationId: string | null | undefined,
  sectorId: string | null | undefined,
  userRole: string | null | undefined,
  minRole: "VIEWER_ONLY" | "VIEWER_DOWNLOAD" | "EDITOR" | "ADMIN" = "VIEWER_DOWNLOAD"
): Promise<void> {
  if (userRole === "SUPER_ADMIN" || userRole === "ADMIN") return;
  if (!sectorId) return;
  if (!userId || !organizationId) throw new AuthorizationError("Sessão de usuário inválida.");

  const membership = await prisma.sectorUser.findUnique({
    where: {
      sectorId_userId: {
        sectorId,
        userId,
      },
    },
    include: { sector: true },
  });

  if (!membership || membership.sector.organizationId !== organizationId) {
    throw new AuthorizationError("Acesso negado: você não pertence a esta Secretaria.");
  }

  const roleWeights: Record<string, number> = {
    ADMIN: 4,
    EDITOR: 3,
    VIEWER_DOWNLOAD: 2,
    VIEWER_ONLY: 1,
    NO_ACCESS: 0,
  };

  const targetWeight = roleWeights[minRole] ?? 2;
  const userWeight = roleWeights[membership.role] ?? 0;

  if (userWeight < targetWeight) {
    throw new AuthorizationError("Permissão insuficiente nesta Secretaria.");
  }
}

export async function getUserSectorIds(
  userId: string | null | undefined,
  organizationId: string | null | undefined,
  userRole: string | null | undefined
): Promise<string[] | null> {
  if (userRole === "SUPER_ADMIN" || userRole === "ADMIN") return null;
  if (!userId || !organizationId) return [];

  const memberships = await prisma.sectorUser.findMany({
    where: {
      userId,
      sector: { organizationId, deletedAt: null },
      role: { in: ["ADMIN", "EDITOR", "VIEWER_DOWNLOAD", "VIEWER_ONLY"] },
    },
    select: { sectorId: true },
  });

  return memberships.map((m) => m.sectorId);
}
