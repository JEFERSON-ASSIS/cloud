import { prisma } from "@i7ai/database";

export function cleanName(value: string) {
  const name = value
    .normalize("NFC")
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!name || name === "." || name === ".." || name.length > 180)
    throw new Error("Nome inválido.");
  return name;
}

export async function assertFolder(
  organizationId: string,
  folderId?: string | null,
) {
  if (!folderId) return null;
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, organizationId, deletedAt: null },
  });
  if (!folder) throw new Error("Pasta não encontrada.");
  return folder;
}

export async function folderBreadcrumbs(
  organizationId: string,
  folderId?: string | null,
) {
  const result: { id: string; name: string }[] = [];
  let current = folderId ?? null;
  for (let depth = 0; current && depth < 50; depth += 1) {
    const folder = await prisma.folder.findFirst({
      where: { id: current, organizationId, deletedAt: null },
      select: { id: true, name: true, parentId: true },
    });
    if (!folder) throw new Error("Caminho de pasta inválido.");
    result.unshift({ id: folder.id, name: folder.name });
    current = folder.parentId;
  }
  return result;
}

export async function isDescendant(
  organizationId: string,
  candidateId: string,
  folderId: string,
) {
  let current: string | null = candidateId;
  for (let depth = 0; current && depth < 50; depth += 1) {
    if (current === folderId) return true;
    const parent: { parentId: string | null } | null =
      await prisma.folder.findFirst({
        where: { id: current, organizationId },
        select: { parentId: true },
      });
    current = parent?.parentId ?? null;
  }
  return false;
}
