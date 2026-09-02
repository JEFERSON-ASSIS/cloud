export type FolderListing = { folders: Array<{ id: string; name: string }> };

export type FolderResolverOptions = {
  rootFolderId: string;
  listFolders: (parentId: string) => Promise<FolderListing>;
  createFolder: (name: string, parentId: string) => Promise<string>;
};

/**
 * Reproduz a higienização de `cleanName` do servidor para que a comparação
 * encontre a pasta que já existe mesmo quando o nome no disco tinha
 * caracteres que o servidor troca por espaço.
 */
export function comparableFolderName(value: string) {
  return value
    .normalize("NFC")
    .replace(/[\u0000-\u001f<>:"\/\\|?*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function createFolderResolver(options: FolderResolverOptions) {
  const pending = new Map<string, Promise<string>>();

  const resolvePath = (path: string[]): Promise<string> => {
    if (!path.length) return Promise.resolve(options.rootFolderId);

    const key = path.map(comparableFolderName).join("/");
    const cached = pending.get(key);
    if (cached) return cached;

    const resolved = (async () => {
      const parentId = await resolvePath(path.slice(0, -1));
      const name = path[path.length - 1]!;
      const wanted = comparableFolderName(name);

      const listing = await options.listFolders(parentId);
      const existing = listing.folders.find(
        (folder) => comparableFolderName(folder.name) === wanted,
      );
      if (existing) return existing.id;

      return options.createFolder(name, parentId);
    })();

    pending.set(key, resolved);
    return resolved;
  };

  return resolvePath;
}
