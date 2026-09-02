export type UploadEntry = {
  file: File;
  path: string[];
};

export type UploadDirectory = {
  path: string[];
  parentPath: string[];
  name: string;
};

export type UploadPlan = {
  directories: UploadDirectory[];
  files: UploadEntry[];
};

function normalizeSegments(segments: string[]): string[] {
  return segments.filter((segment) => segment && segment !== "." && segment !== "..");
}

export function relativePathOf(file: File): string[] {
  const relativePath = (file as File & { webkitRelativePath?: string })
    .webkitRelativePath;
  if (!relativePath) return [];
  return normalizeSegments(relativePath.split("/")).slice(0, -1);
}

export function planFolderUploads(entries: UploadEntry[]): UploadPlan {
  const directories = new Map<string, UploadDirectory>();

  for (const entry of entries) {
    for (let depth = 1; depth <= entry.path.length; depth += 1) {
      const path = entry.path.slice(0, depth);
      const key = path.join("/");
      if (directories.has(key)) continue;
      directories.set(key, {
        path,
        parentPath: path.slice(0, -1),
        name: path[depth - 1]!,
      });
    }
  }

  return {
    directories: [...directories.values()].sort(
      (a, b) => a.path.length - b.path.length,
    ),
    files: entries,
  };
}

type DirectoryReader = {
  readEntries: (
    onSuccess: (entries: FileSystemEntryLike[]) => void,
    onError?: (error: unknown) => void,
  ) => void;
};

type FileSystemEntryLike = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (onSuccess: (file: File) => void, onError?: (error: unknown) => void) => void;
  createReader?: () => DirectoryReader;
};

function readFile(entry: FileSystemEntryLike): Promise<File | null> {
  if (!entry.file) return Promise.resolve(null);
  return new Promise((resolve) => {
    entry.file!(
      (file) => resolve(file),
      () => resolve(null),
    );
  });
}

function readDirectory(reader: DirectoryReader): Promise<FileSystemEntryLike[]> {
  return new Promise((resolve) => {
    reader.readEntries(
      (entries) => resolve(entries),
      () => resolve([]),
    );
  });
}

async function walkEntry(
  entry: FileSystemEntryLike,
  path: string[],
  collected: UploadEntry[],
): Promise<void> {
  if (entry.isFile) {
    const file = await readFile(entry);
    if (file) collected.push({ file, path });
    return;
  }
  if (!entry.isDirectory || !entry.createReader) return;

  const reader = entry.createReader();
  const childPath = [...path, entry.name];
  for (;;) {
    const batch = await readDirectory(reader);
    if (!batch.length) break;
    for (const child of batch) {
      await walkEntry(child, childPath, collected);
    }
  }
}

export async function collectDroppedEntries(
  transfer: DataTransfer,
): Promise<UploadEntry[]> {
  const items = Array.from(transfer.items ?? []) as unknown as Array<{
    kind: string;
    webkitGetAsEntry?: () => FileSystemEntryLike | null;
  }>;
  const roots = items
    .filter((item) => item.kind === "file" && item.webkitGetAsEntry)
    .map((item) => item.webkitGetAsEntry!())
    .filter((entry): entry is FileSystemEntryLike => Boolean(entry));

  if (!roots.length) {
    return Array.from(transfer.files ?? []).map((file) => ({ file, path: [] }));
  }

  const collected: UploadEntry[] = [];
  for (const root of roots) {
    await walkEntry(root, [], collected);
  }
  return collected;
}
