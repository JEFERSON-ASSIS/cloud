"use client";
import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowBack,
  CheckCircle,
  Close,
  CloudUpload,
  Delete,
  Download,
  DriveFolderUpload,
  Error as ErrorIcon,
  Folder,
  GridView,
  InsertDriveFile,
  List,
  MoreVert,
  Restore,
  Schedule,
  ShareOutlined,
  Upload,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { DocumentPreview } from "@/components/DocumentPreview/DocumentPreview";
import { useActiveTenant } from "@/components/AppShell/ActiveTenantContext";
import { resolveFilesBackTarget } from "@/lib/files-navigation";
import {
  collectDroppedEntries,
  planFolderUploads,
  relativePathOf,
  type UploadEntry,
} from "@/lib/upload-tree";
import { createFolderResolver } from "@/lib/upload-folder-resolver";
import {
  isSelectable,
  selectableKeys,
  selectionKey,
  toggleSelectAll,
  toggleSelection,
} from "@/lib/files-selection";
import { useSearchParams } from "next/navigation";

type Item = {
  id: string;
  kind: "folder" | "document";
  name: string;
  size?: string;
  mimeType?: string;
  updatedAt: string;
  shared?: boolean;
  virtual?: boolean;
  shareId?: string;
  shareCount?: number;
  sourceSectorName?: string;
  sharedByName?: string;
  canDownload?: boolean;
};
type Listing = {
  breadcrumbs: { id: string; name: string }[];
  folders: Item[];
  documents: Item[];
  sharedView?: boolean;
  canShare?: boolean;
};

const EMPTY_LISTING: Listing = {
  breadcrumbs: [],
  folders: [],
  documents: [],
};

type ShareDialogData = {
  shares: {
    id: string;
    permission: "VIEW" | "DOWNLOAD";
    targetSector: { id: string; name: string };
    targetUser: { id: string; name: string; email: string } | null;
    createdBy: { id: string; name: string };
    createdAt: string;
  }[];
  sectors: {
    id: string;
    name: string;
    users: { id: string; name: string; email: string }[];
  }[];
};

type UploadStatus = "pending" | "uploading" | "done" | "error";

type UploadJob = {
  id: string;
  name: string;
  folderPath?: string;
  size: number;
  status: UploadStatus;
  progress: number;
  phase?: "sending" | "validating";
  error?: string;
};

type UploadSessionResult = {
  uploadId: string;
  chunkSize: number;
  uploadedBytes: number;
};

type UploadChunkResult = {
  uploadedBytes: number;
  complete: boolean;
  readyToFinalize: boolean;
};

type UploadStatusResult = UploadChunkResult & {
  uploadId: string;
  chunkSize: number;
  status: string;
  size: number;
  documentId?: string | null;
  error?: string | null;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function responseJson<T>(response: Response): Promise<T> {
  const result = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) throw new Error(result.error || "Falha no upload.");
  return result;
}

function sendUploadChunk(input: {
  url: string;
  chunk: Blob;
  start: number;
  total: number;
  onProgress: (loaded: number) => void;
}): Promise<UploadChunkResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const end = input.start + input.chunk.size - 1;
    xhr.open("PUT", input.url);
    xhr.setRequestHeader(
      "Content-Range",
      `bytes ${input.start}-${end}/${input.total}`,
    );
    xhr.upload.onprogress = (event) => input.onProgress(event.loaded);
    xhr.onload = () => {
      let result: (UploadChunkResult & { error?: string }) | undefined;
      try {
        result = JSON.parse(xhr.responseText || "{}") as UploadChunkResult & {
          error?: string;
        };
      } catch {
        result = undefined;
      }
      if (xhr.status >= 200 && xhr.status < 300 && result) resolve(result);
      else reject(new Error(result?.error || "Falha ao enviar uma parte do arquivo."));
    };
    xhr.onerror = () => reject(new Error("Conexão interrompida durante o upload."));
    xhr.onabort = () => reject(new Error("Upload cancelado."));
    xhr.send(input.chunk);
  });
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function uploadResumeKey(
  file: File,
  organizationId: string | null,
  sectorId: string | null,
  folderId: string | null,
) {
  return [
    "i7ai-upload",
    organizationId || "default",
    sectorId || "root",
    folderId || "root",
    file.name,
    file.size,
    file.lastModified,
  ].join(":");
}

export default function FilesPage() {
  const { activeOrganizationId, activeSectorId } = useActiveTenant();
  const query = useSearchParams();
  const [folderId, setFolderId] = useState<string | null>(
      query.get("folderId"),
    ),
    [loadedData, setLoadedData] = useState<Listing>(EMPTY_LISTING),
    [loadedSectorId, setLoadedSectorId] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [trash, setTrash] = useState(false),
    [sharedView, setSharedView] = useState(false),
    [grid, setGrid] = useState(true),
    [dialog, setDialog] = useState(false),
    [folderName, setFolderName] = useState(""),
    [menu, setMenu] = useState<{ anchor: HTMLElement; item: Item } | null>(
      null,
    ),
    [preview, setPreview] = useState<Item | null>(null),
    [moveItem, setMoveItem] = useState<Item | null>(null),
    [moveTarget, setMoveTarget] = useState(""),
    [allFolders, setAllFolders] = useState<Item[]>([]);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [canDownload, setCanDownload] = useState(true);
  const [uploadQueue, setUploadQueue] = useState<UploadJob[]>([]);
  const [uploadPanelOpen, setUploadPanelOpen] = useState(false);
  const [shareItem, setShareItem] = useState<Item | null>(null);
  const [shareData, setShareData] = useState<ShareDialogData | null>(null);
  const [shareSectorId, setShareSectorId] = useState("");
  const [shareUserId, setShareUserId] = useState("");
  const [sharePermission, setSharePermission] = useState<"VIEW" | "DOWNLOAD">("VIEW");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  // a seleção guarda o contexto em que foi feita; ao navegar para outra
  // pasta/secretaria/lixeira/busca ela é descartada durante o render, para
  // nunca excluir item que saiu da tela
  const [selection, setSelection] = useState<{
    scope: string;
    keys: Set<string>;
  }>({ scope: "", keys: new Set() });
  const [bulkDialog, setBulkDialog] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const uploadingRef = useRef(false);
  const loadRequestRef = useRef(0);

  const data = loadedSectorId === activeSectorId ? loadedData : EMPTY_LISTING;

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    if (!activeSectorId) {
      setLoadedData(EMPTY_LISTING);
      setLoadedSectorId(null);
      setError("");
      setBusy(false);
      return;
    }

    setBusy(true);
    const p = new URLSearchParams();
    if (folderId) p.set("folderId", folderId);
    if (search) p.set("search", search);
    if (trash) p.set("trash", "1");
    if (sharedView) p.set("shared", "1");
    const activeOrgId = activeOrganizationId;
    if (activeOrgId) p.set("organizationId", activeOrgId);
    if (activeSectorId) p.set("sectorId", activeSectorId);

    try {
      const r = await fetch(`/api/files?${p}`);
      const b = await r.json();
      if (requestId !== loadRequestRef.current) return;
      if (r.ok) {
        setLoadedData(b);
        setLoadedSectorId(activeSectorId);
        setError("");
        setIsReadOnly(b.isReadOnly ?? false);
        setCanDownload(b.canDownload ?? !(b.isReadOnly ?? false));
      } else {
        setLoadedData(EMPTY_LISTING);
        setLoadedSectorId(null);
        setError(b.error);
      }
    } catch {
      if (requestId === loadRequestRef.current) {
        setLoadedData(EMPTY_LISTING);
        setLoadedSectorId(null);
        setError("Erro ao carregar arquivos.");
      }
    } finally {
      if (requestId === loadRequestRef.current) setBusy(false);
    }
  }, [folderId, search, trash, sharedView, activeOrganizationId, activeSectorId]);


  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      loadRequestRef.current += 1;
    };
  }, [load]);

  useEffect(() => {
    const handleTenantChange = () => {
      loadRequestRef.current += 1;
      setLoadedData(EMPTY_LISTING);
      setLoadedSectorId(null);
      setFolderId(null);
      setSharedView(false);
      setTrash(false);
    };
    window.addEventListener("active-org-changed", handleTenantChange);
    window.addEventListener("active-sector-changed", handleTenantChange);
    return () => {
      window.removeEventListener("active-org-changed", handleTenantChange);
      window.removeEventListener("active-sector-changed", handleTenantChange);
    };
  }, []);

  const patchUploadJob = (id: string, patch: Partial<UploadJob>) => {
    setUploadQueue((current) =>
      current.map((job) => (job.id === id ? { ...job, ...patch } : job)),
    );
  };

  const uploadFiles = async (source: FileList | File[] | UploadEntry[]) => {
    const entries: UploadEntry[] = Array.from(source as ArrayLike<unknown>).map(
      (item) =>
        item instanceof File
          ? { file: item, path: relativePathOf(item) }
          : (item as UploadEntry),
    );
    if (!entries.length) return;
    if (!folderId || sharedView || trash) {
      setError("Abra a pasta da secretaria antes de enviar arquivos.");
      return;
    }
    if (uploadingRef.current) {
      setError("Aguarde o envio atual terminar para adicionar mais arquivos.");
      return;
    }

    const plan = planFolderUploads(entries);
    const selected = plan.files;
    const organizationQuery = activeOrganizationId
      ? `?organizationId=${encodeURIComponent(activeOrganizationId)}`
      : "";
    const resolveFolder = createFolderResolver({
      rootFolderId: folderId,
      listFolders: async (parentId) => {
        const params = new URLSearchParams({ folderId: parentId });
        if (activeOrganizationId) params.set("organizationId", activeOrganizationId);
        if (activeSectorId) params.set("sectorId", activeSectorId);
        const response = await fetch(`/api/files?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Não foi possível verificar as pastas de destino.");
        }
        return (await response.json()) as { folders: { id: string; name: string }[] };
      },
      createFolder: async (name, parentId) => {
        const created = await responseJson<{ id: string }>(
          await fetch("/api/folders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              parentId,
              sectorId: activeSectorId,
              organizationId: activeOrganizationId,
            }),
          }),
        );
        return created.id;
      },
    });

    const jobs: UploadJob[] = selected.map((entry, index) => ({
      id: `${Date.now()}-${index}-${entry.file.name}`,
      name: entry.file.name,
      folderPath: entry.path.join("/"),
      size: entry.file.size,
      status: "pending",
      progress: 0,
    }));

    setUploadQueue(jobs);
    setUploadPanelOpen(true);
    uploadingRef.current = true;

    let hadSuccess = false;
    for (let i = 0; i < selected.length; i += 1) {
      const file = selected[i]!.file;
      const job = jobs[i]!;
      patchUploadJob(job.id, { status: "uploading", progress: 0, phase: "sending" });

      try {
        const destinationFolderId = await resolveFolder(selected[i]!.path);
        const resumeKey = uploadResumeKey(
          file,
          activeOrganizationId,
          activeSectorId,
          destinationFolderId,
        );
        let created: UploadSessionResult | undefined;
        const savedUploadId = window.localStorage.getItem(resumeKey);
        if (savedUploadId) {
          const savedResponse = await fetch(
            `/api/documents/uploads/${savedUploadId}${organizationQuery}`,
          );
          if (savedResponse.ok) {
            const saved = (await savedResponse.json()) as UploadStatusResult;
            if (saved.status === "COMPLETED" && saved.documentId) {
              window.localStorage.removeItem(resumeKey);
              patchUploadJob(job.id, { status: "done", progress: 100 });
              hadSuccess = true;
              continue;
            }
            if (saved.status === "ACTIVE" && saved.size === file.size) {
              created = {
                uploadId: saved.uploadId,
                chunkSize: saved.chunkSize,
                uploadedBytes: saved.uploadedBytes,
              };
            }
          }
          if (!created) window.localStorage.removeItem(resumeKey);
        }
        if (!created) {
          created = await responseJson<UploadSessionResult>(
            await fetch("/api/documents/uploads", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: file.name,
                size: file.size,
                mimeType: file.type || "application/octet-stream",
                folderId: destinationFolderId,
                sectorId: activeSectorId,
                organizationId: activeOrganizationId,
              }),
            }),
          );
          window.localStorage.setItem(resumeKey, created.uploadId);
        }
        const uploadUrl = `/api/documents/uploads/${created.uploadId}`;
        let offset = created.uploadedBytes;
        while (offset < file.size) {
          const start = offset;
          const end = Math.min(start + created.chunkSize, file.size);
          const chunk = file.slice(start, end);
          let sent = false;
          let lastError: Error | undefined;
          for (let attempt = 0; attempt < 3 && !sent; attempt += 1) {
            try {
              const result = await sendUploadChunk({
                url: `${uploadUrl}/chunk${organizationQuery}`,
                chunk,
                start,
                total: file.size,
                onProgress: (loaded) => {
                  patchUploadJob(job.id, {
                    progress: Math.min(
                      98,
                      Math.round(((start + loaded) / file.size) * 100),
                    ),
                  });
                },
              });
              offset = result.uploadedBytes;
              sent = true;
            } catch (chunkError) {
              lastError =
                chunkError instanceof Error
                  ? chunkError
                  : new Error("Falha ao enviar uma parte do arquivo.");
              const statusResponse = await fetch(`${uploadUrl}${organizationQuery}`);
              if (statusResponse.ok) {
                const status = (await statusResponse.json()) as UploadStatusResult;
                if (status.uploadedBytes > start || status.readyToFinalize) {
                  offset = status.uploadedBytes;
                  sent = true;
                  break;
                }
              }
              if (attempt < 2) await wait(500 * 2 ** attempt);
            }
          }
          if (!sent) throw lastError ?? new Error("Falha ao enviar o arquivo.");
        }
        patchUploadJob(job.id, {
          status: "uploading",
          progress: 99,
          phase: "validating",
        });
        await responseJson(
          await fetch(`${uploadUrl}/complete${organizationQuery}`, {
            method: "POST",
          }),
        );
        window.localStorage.removeItem(resumeKey);
        patchUploadJob(job.id, { status: "done", progress: 100 });
        hadSuccess = true;
      } catch (uploadError) {
        const message =
          uploadError instanceof Error ? uploadError.message : "Falha no upload.";
        patchUploadJob(job.id, { status: "error", error: message });
      }
    }

    uploadingRef.current = false;
    if (input.current) input.current.value = "";
    if (folderInput.current) folderInput.current.value = "";
    if (hadSuccess) await load();
  };

  const clearFinishedUploads = () => {
    setUploadQueue((current) =>
      current.filter((job) => job.status === "pending" || job.status === "uploading"),
    );
  };

  const uploadStats = {
    total: uploadQueue.length,
    done: uploadQueue.filter((job) => job.status === "done").length,
    error: uploadQueue.filter((job) => job.status === "error").length,
    active: uploadQueue.some(
      (job) => job.status === "pending" || job.status === "uploading",
    ),
  };

  const createFolder = async () => {
    if (!folderId || sharedView || trash) {
      setError("Abra a pasta da secretaria antes de criar uma pasta.");
      return;
    }
    const r = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: folderName, parentId: folderId, sectorId: activeSectorId, organizationId: activeOrganizationId }),
    });
    const b = await r.json();
    if (!r.ok) setError(b.error);
    else {
      setDialog(false);
      setFolderName("");
      await load();
    }
  };

  const loadShareData = async (item: Item) => {
    const params = new URLSearchParams({
      resourceType: item.kind,
      resourceId: item.id,
    });
    if (activeOrganizationId) params.set("organizationId", activeOrganizationId);
    const response = await fetch(`/api/document-shares?${params}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Erro ao consultar compartilhamentos.");
    setShareData(result);
    return result as ShareDialogData;
  };

  const openShareDialog = async (item: Item) => {
    setShareItem(item);
    setShareData(null);
    setShareSectorId("");
    setShareUserId("");
    setSharePermission("VIEW");
    setShareError("");
    setShareBusy(true);
    setShareError("");
    try {
      await loadShareData(item);
    } catch (shareError) {
      setShareItem(null);
      setError(
        shareError instanceof Error
          ? shareError.message
          : "Erro ao consultar compartilhamentos.",
      );
    } finally {
      setShareBusy(false);
    }
  };

  const createShare = async () => {
    if (!shareItem || !shareSectorId) return;
    setShareBusy(true);
    try {
      const response = await fetch("/api/document-shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: activeOrganizationId,
          resourceType: shareItem.kind,
          resourceId: shareItem.id,
          targetSectorId: shareSectorId,
          targetUserId: shareUserId || null,
          permission: sharePermission,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro ao compartilhar item.");
      await loadShareData(shareItem);
      await load();
      setShareUserId("");
    } catch (shareError) {
      setShareError(
        shareError instanceof Error ? shareError.message : "Erro ao compartilhar item.",
      );
    } finally {
      setShareBusy(false);
    }
  };

  const revokeShare = async (shareId: string) => {
    if (!shareItem) return;
    setShareBusy(true);
    setShareError("");
    try {
      const params = new URLSearchParams();
      if (activeOrganizationId) params.set("organizationId", activeOrganizationId);
      const response = await fetch(`/api/document-shares/${shareId}?${params}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro ao revogar compartilhamento.");
      await loadShareData(shareItem);
      await load();
    } catch (shareError) {
      setShareError(
        shareError instanceof Error
          ? shareError.message
          : "Erro ao revogar compartilhamento.",
      );
    } finally {
      setShareBusy(false);
    }
  };

  const action = async (item: Item, kind: string) => {
    setMenu(null);
    if (kind === "download") {
      const params = new URLSearchParams({ download: "1" });
      if (item.shared && activeSectorId) params.set("targetSectorId", activeSectorId);
      window.open(`/api/documents/${item.id}/content?${params}`, "_self");
      return;
    }
    if (kind === "preview") {
      setPreview(item);
      return;
    }
    if (kind === "move") {
      const params = new URLSearchParams({ allFolders: "1" });
      if (activeOrganizationId) params.set("organizationId", activeOrganizationId);
      if (activeSectorId) params.set("sectorId", activeSectorId);
      const response = await fetch(`/api/files?${params}`);
      const listing = (await response.json()) as Listing;
      setAllFolders(listing.folders.filter((folder) => folder.id !== item.id));
      setMoveTarget("");
      setMoveItem(item);
      return;
    }
    if (kind === "share") {
      await openShareDialog(item);
      return;
    }
    if (item.shared || item.virtual) return;
    const payload: { action: string; name?: string } = { action: kind };
    if (kind === "rename") {
      const name = prompt("Novo nome", item.name);
      if (!name) return;
      payload.name = name;
    }
    const r = await fetch(
      `/api/${item.kind === "folder" ? "folders" : "documents"}/${item.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const b = await r.json();
    if (!r.ok) setError(b.error);
    await load();
  };

  const items = [...data.folders, ...data.documents];
  const selectionScope = [
    activeOrganizationId ?? "",
    activeSectorId ?? "",
    folderId ?? "",
    search,
    trash ? "1" : "",
    sharedView ? "1" : "",
  ].join("|");
  const selected =
    selection.scope === selectionScope ? selection.keys : new Set<string>();
  const setSelected = (keys: Set<string>) =>
    setSelection({ scope: selectionScope, keys });
  const selectableItemKeys = selectableKeys(items, isReadOnly);
  const selectedItems = items.filter(
    (item) => isSelectable(item, isReadOnly) && selected.has(selectionKey(item)),
  );

  const trashSelected = async () => {
    setBulkBusy(true);
    let failed = 0;
    for (const item of selectedItems) {
      try {
        const response = await fetch(
          `/api/${item.kind === "folder" ? "folders" : "documents"}/${item.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "trash" }),
          },
        );
        if (!response.ok) failed += 1;
      } catch {
        failed += 1;
      }
    }
    const total = selectedItems.length;
    setBulkBusy(false);
    setBulkDialog(false);
    setSelected(new Set());
    // `load` limpa o erro, então o aviso de falha parcial vem depois dele
    await load();
    if (failed) {
      setError(
        `${failed} de ${total} ${total === 1 ? "item não foi excluído" : "itens não foram excluídos"}.`,
      );
    }
  };

  const backTarget = resolveFilesBackTarget({
    folderId,
    sharedView,
    trash,
    breadcrumbs: data.breadcrumbs,
  });
  const shareUsers =
    shareData?.sectors.find((sector) => sector.id === shareSectorId)?.users ?? [];
  const drop = (e: DragEvent) => {
    e.preventDefault();
    if (isReadOnly || sharedView || trash || !folderId) return;
    void (async () => {
      try {
        await uploadFiles(await collectDroppedEntries(e.dataTransfer));
      } catch {
        setError("Não foi possível ler a pasta arrastada.");
      }
    })();
  };

  return (
    <Stack spacing={2} onDragOver={(e) => e.preventDefault()} onDrop={drop}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ justifyContent: "space-between", gap: 2 }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Arquivos
          </Typography>
          <Breadcrumbs>
            <Button
              size="small"
              onClick={() => {
                setFolderId(null);
                setSharedView(false);
                setTrash(false);
              }}
            >
              Documentos
            </Button>
            {data.breadcrumbs.map((x) => (
              <Button
                size="small"
                key={x.id}
                onClick={() => {
                  if (x.id === "__shared__") {
                    setSharedView(true);
                    setFolderId(null);
                  } else {
                    setFolderId(x.id);
                  }
                }}
              >
                {x.name}
              </Button>
            ))}
          </Breadcrumbs>
        </Box>
        {!isReadOnly && !sharedView && !trash && folderId && (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0 }}>
            <Button
              variant="outlined"
              size="medium"
              onClick={() => setDialog(true)}
              startIcon={<Folder />}
              sx={{
                borderRadius: 2,
                px: 2,
                textTransform: "none",
                fontWeight: 600,
                borderColor: "divider",
                color: "text.primary",
                bgcolor: "background.paper",
                "&:hover": {
                  borderColor: "primary.main",
                  bgcolor: "action.hover",
                },
              }}
            >
              Nova pasta
            </Button>
            <Button
              variant="contained"
              size="medium"
              disableElevation
              startIcon={<Upload />}
              onClick={() => input.current?.click()}
              sx={{
                borderRadius: 2,
                px: 2.5,
                textTransform: "none",
                fontWeight: 600,
              }}
            >
              Enviar arquivos
            </Button>
            <Button
              variant="contained"
              size="medium"
              disableElevation
              startIcon={<DriveFolderUpload />}
              onClick={() => folderInput.current?.click()}
              sx={{
                borderRadius: 2,
                px: 2.5,
                textTransform: "none",
                fontWeight: 600,
              }}
            >
              Enviar pasta
            </Button>
            <input
              hidden
              multiple
              ref={input}
              type="file"
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                e.target.files && void uploadFiles(e.target.files)
              }
            />
            <input
              hidden
              multiple
              ref={folderInput}
              type="file"
              // @ts-expect-error atributos de diretório não tipados no React
              webkitdirectory=""
              directory=""
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                e.target.files && void uploadFiles(e.target.files)
              }
            />
          </Stack>
        )}
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {busy && <LinearProgress />}
      {sharedView && (
        <Alert severity="info">
          Estes itens pertencem a outra secretaria. Você pode visualizar e, quando autorizado,
          baixar; alterações permanecem sob controle da secretaria de origem.
        </Alert>
      )}
      {uploadQueue.length > 0 && uploadPanelOpen && (
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            borderRadius: 2,
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Stack spacing={1.5}>
            <Stack
              direction="row"
              sx={{ justifyContent: "space-between", alignItems: "center", gap: 1 }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <CloudUpload color="primary" fontSize="small" />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Fila de envio
                </Typography>
                <Chip
                  size="small"
                  label={`${uploadStats.done}/${uploadStats.total} enviados`}
                  color={uploadStats.error ? "warning" : "default"}
                />
                {uploadStats.error > 0 && (
                  <Chip size="small" color="error" label={`${uploadStats.error} com erro`} />
                )}
              </Stack>
              <Stack direction="row" spacing={0.5}>
                {!uploadStats.active && (
                  <Button size="small" onClick={clearFinishedUploads} sx={{ textTransform: "none" }}>
                    Limpar
                  </Button>
                )}
                <IconButton
                  size="small"
                  aria-label="Fechar fila de envio"
                  onClick={() => setUploadPanelOpen(false)}
                  disabled={uploadStats.active}
                >
                  <Close fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>

            <Stack spacing={1.25} sx={{ maxHeight: 280, overflowY: "auto" }}>
              {uploadQueue.map((job) => (
                <Box
                  key={job.id}
                  sx={{
                    p: 1.25,
                    borderRadius: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: "action.hover",
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "flex-start", justifyContent: "space-between" }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", minWidth: 0 }}>
                      {job.status === "done" ? (
                        <CheckCircle color="success" fontSize="small" sx={{ mt: 0.25 }} />
                      ) : job.status === "error" ? (
                        <ErrorIcon color="error" fontSize="small" sx={{ mt: 0.25 }} />
                      ) : job.status === "uploading" ? (
                        <CloudUpload color="primary" fontSize="small" sx={{ mt: 0.25 }} />
                      ) : (
                        <Schedule color="disabled" fontSize="small" sx={{ mt: 0.25 }} />
                      )}
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={job.folderPath ? `${job.folderPath}/${job.name}` : job.name}
                        >
                          {job.folderPath ? `${job.folderPath}/${job.name}` : job.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatBytes(job.size)}
                          {job.status === "pending" && " · Na fila"}
                          {job.status === "uploading" &&
                            (job.phase === "validating"
                              ? " · Validando integridade"
                              : ` · Enviando ${job.progress}%`)}
                          {job.status === "done" && " · Enviado"}
                          {job.status === "error" && ` · ${job.error || "Erro"}`}
                        </Typography>
                      </Box>
                    </Stack>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={
                        job.status === "done"
                          ? "success"
                          : job.status === "error"
                            ? "error"
                            : job.status === "uploading"
                              ? "primary"
                              : "default"
                      }
                      label={
                        job.status === "done"
                          ? "Enviado"
                          : job.status === "error"
                            ? "Erro"
                            : job.status === "uploading"
                              ? job.phase === "validating"
                                ? "Validando"
                                : "Enviando"
                              : "Aguardando"
                      }
                    />
                  </Stack>
                  {(job.status === "uploading" || job.status === "pending") && (
                    <LinearProgress
                      sx={{ mt: 1, borderRadius: 1 }}
                      variant={job.status === "uploading" ? "determinate" : "indeterminate"}
                      value={job.status === "uploading" ? job.progress : undefined}
                    />
                  )}
                </Box>
              ))}
            </Stack>
          </Stack>
        </Paper>
      )}
      {!uploadPanelOpen && uploadQueue.length > 0 && (
        <Alert
          severity={uploadStats.error ? "warning" : "info"}
          action={
            <Button color="inherit" size="small" onClick={() => setUploadPanelOpen(true)}>
              Ver fila
            </Button>
          }
        >
          {uploadStats.active
            ? `Enviando arquivos… ${uploadStats.done}/${uploadStats.total}`
            : `Envio finalizado: ${uploadStats.done} ok` +
              (uploadStats.error ? `, ${uploadStats.error} com erro` : "")}
        </Alert>
      )}
      <Stack direction="row" sx={{ gap: 1 }}>
        {backTarget && (
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => {
              setFolderId(backTarget.folderId);
              setSharedView(backTarget.sharedView);
              setTrash(backTarget.trash);
            }}
            sx={{ flexShrink: 0, textTransform: "none" }}
          >
            Voltar
          </Button>
        )}
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar arquivos e pastas"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {!trash && !sharedView && (
          <Button
            color="inherit"
            onClick={() => {
              setTrash(true);
              setFolderId(null);
            }}
          >
            Lixeira
          </Button>
        )}
        <Tooltip title={grid ? "Exibir em lista" : "Exibir em grade"}>
          <IconButton onClick={() => setGrid(!grid)}>
            {grid ? <List /> : <GridView />}
          </IconButton>
        </Tooltip>
      </Stack>
      {selectableItemKeys.length > 0 && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", px: 0.5, minHeight: 42 }}
        >
          <Checkbox
            size="small"
            slotProps={{ input: { "aria-label": "Selecionar todos" } }}
            checked={
              selectedItems.length > 0 &&
              selectedItems.length === selectableItemKeys.length
            }
            indeterminate={
              selectedItems.length > 0 &&
              selectedItems.length < selectableItemKeys.length
            }
            onChange={() =>
              setSelected(toggleSelectAll(selected, items, isReadOnly))
            }
          />
          {selectedItems.length > 0 ? (
            <>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {selectedItems.length}
                {selectedItems.length === 1 ? " selecionado" : " selecionados"}
              </Typography>
              {!trash && (
                <Button
                  size="small"
                  color="error"
                  startIcon={<Delete fontSize="small" />}
                  onClick={() => setBulkDialog(true)}
                  sx={{ textTransform: "none", fontWeight: 600 }}
                >
                  Excluir
                </Button>
              )}
              <Button
                size="small"
                onClick={() => setSelected(new Set())}
                sx={{ textTransform: "none" }}
              >
                Limpar seleção
              </Button>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Selecione itens para excluir vários de uma vez
            </Typography>
          )}
        </Stack>
      )}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          minHeight: 300,
          borderStyle: items.length ? "solid" : "dashed",
        }}
      >
        {items.length === 0 ? (
          <Stack sx={{ alignItems: "center", py: 8 }}>
            <Upload color="disabled" sx={{ fontSize: 48 }} />
            <Typography variant="h6">
              {trash
                ? "A lixeira está vazia"
                : sharedView
                  ? "Nenhum item foi compartilhado com esta secretaria"
                  : folderId
                    ? "Arraste arquivos para cá"
                    : "Nenhuma pasta de secretaria disponível"}
            </Typography>
            <Typography color="text.secondary">
              {sharedView
                ? "Quando outra secretaria compartilhar uma pasta ou arquivo, ele aparecerá aqui."
                : folderId
                  ? "Ou use os botões acima para começar."
                  : "Selecione a pasta da secretaria para criar pastas e enviar arquivos."}
            </Typography>
          </Stack>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: grid
                ? "repeat(auto-fill,minmax(190px,1fr))"
                : "1fr",
              gap: 1,
            }}
          >
            {items.map((item) => (
              <Card key={`${item.kind}-${item.id}`} variant="outlined">
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    p: 1.5,
                    cursor: "pointer",
                    borderRadius: 1,
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                  onDoubleClick={() => {
                    if (item.virtual) {
                      setSharedView(true);
                      setFolderId(null);
                    } else if (item.kind === "folder") {
                      setFolderId(item.id);
                    } else {
                      void action(item, "preview");
                    }
                  }}
                >
                  {isSelectable(item, isReadOnly) && (
                    <Checkbox
                      size="small"
                      sx={{ mr: 0.5 }}
                      slotProps={{
                        input: { "aria-label": `Selecionar ${item.name}` },
                      }}
                      checked={selected.has(selectionKey(item))}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() =>
                        setSelected(toggleSelection(selected, selectionKey(item)))
                      }
                    />
                  )}
                  {item.kind === "folder" ? (
                    <Folder color="primary" sx={{ mr: 2 }} />
                  ) : (
                    <InsertDriveFile color="action" sx={{ mr: 2 }} />
                  )}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography noWrap sx={{ fontWeight: 600, fontSize: 14 }}>
                      {item.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.kind === "folder"
                        ? "Pasta"
                        : `${(Number(item.size) / 1024).toFixed(1)} KB`}
                    </Typography>
                    {item.shared && item.sourceSectorName && (
                      <Typography
                        variant="caption"
                        color="primary"
                        sx={{ display: "block" }}
                        noWrap
                      >
                        Compartilhado por {item.sourceSectorName}
                      </Typography>
                    )}
                    {!item.shared && Boolean(item.shareCount) && (
                      <Chip
                        size="small"
                        variant="outlined"
                        color="primary"
                        label={`Compartilhado com ${item.shareCount}`}
                        sx={{ mt: 0.5, height: 22 }}
                      />
                    )}
                  </Box>
                  {!item.virtual && (
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenu({ anchor: e.currentTarget, item });
                      }}
                    >
                      <MoreVert />
                    </IconButton>
                  )}
                </Box>
              </Card>
            ))}
          </Box>
        )}
      </Paper>
      <Menu open={!!menu} anchorEl={menu?.anchor} onClose={() => setMenu(null)}>
        {!trash && menu?.item.kind === "document" && (
          <MenuItem onClick={() => void action(menu.item, "preview")}>
            Visualizar
          </MenuItem>
        )}
        {!trash && menu?.item.kind === "document" &&
          (menu.item.shared ? menu.item.canDownload : canDownload) && (
          <MenuItem onClick={() => void action(menu.item, "download")}>
            <Download fontSize="small" /> Baixar
          </MenuItem>
        )}
        {!isReadOnly && data.canShare && !trash && !menu?.item.shared && (
          <MenuItem onClick={() => menu && void action(menu.item, "share")}>
            <ShareOutlined fontSize="small" /> Compartilhar
          </MenuItem>
        )}
        {!isReadOnly && !trash && !menu?.item.shared && (
          <MenuItem onClick={() => menu && void action(menu.item, "rename")}>
            Renomear
          </MenuItem>
        )}
        {!isReadOnly && !trash && !menu?.item.shared && (
          <MenuItem onClick={() => menu && void action(menu.item, "move")}>
            Mover
          </MenuItem>
        )}
        {!isReadOnly && !menu?.item.shared && (
          <MenuItem
            onClick={() =>
              menu && void action(menu.item, trash ? "restore" : "trash")
            }
          >
            {trash ? <Restore fontSize="small" /> : <Delete fontSize="small" />}
            {trash ? "Restaurar" : "Excluir"}
          </MenuItem>
        )}
      </Menu>
      <Dialog open={bulkDialog} onClose={() => !bulkBusy && setBulkDialog(false)}>
        <DialogTitle>
          {selectedItems.length === 1
            ? "Mover 1 item para a lixeira?"
            : `Mover ${selectedItems.length} itens para a lixeira?`}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Os itens continuam disponíveis na lixeira e podem ser restaurados.
          </Typography>
          {bulkBusy && <LinearProgress sx={{ mt: 2 }} />}
        </DialogContent>
        <DialogActions>
          <Button disabled={bulkBusy} onClick={() => setBulkDialog(false)}>
            Cancelar
          </Button>
          <Button
            color="error"
            variant="contained"
            disableElevation
            disabled={bulkBusy}
            onClick={() => void trashSelected()}
          >
            Mover para a lixeira
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!shareItem}
        onClose={() => !shareBusy && setShareItem(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Compartilhar {shareItem?.name}</DialogTitle>
        <DialogContent dividers>
          {!shareData ? (
            <LinearProgress />
          ) : (
            <Stack spacing={2.5}>
              {shareError && (
                <Alert severity="error" onClose={() => setShareError("")}>
                  {shareError}
                </Alert>
              )}
              <Alert severity="info">
                O destinatário receberá acesso por “Compartilhados comigo”.
              </Alert>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                  Secretaria de destino
                </Typography>
                <Select
                  native
                  fullWidth
                  value={shareSectorId}
                  onChange={(event) => {
                    setShareSectorId(String(event.target.value));
                    setShareUserId("");
                  }}
                >
                  <option value="">Selecione uma secretaria</option>
                  {shareData.sectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </Select>
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                  Destinatário
                </Typography>
                <Select
                  native
                  fullWidth
                  value={shareUserId}
                  disabled={!shareSectorId}
                  onChange={(event) => setShareUserId(String(event.target.value))}
                >
                  <option value="">Toda a secretaria</option>
                  {shareUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} — {user.email}
                    </option>
                  ))}
                </Select>
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                  Permissão
                </Typography>
                <Select
                  native
                  fullWidth
                  value={sharePermission}
                  onChange={(event) =>
                    setSharePermission(String(event.target.value) as "VIEW" | "DOWNLOAD")
                  }
                >
                  <option value="VIEW">Somente visualizar</option>
                  <option value="DOWNLOAD">Visualizar e baixar</option>
                </Select>
              </Box>
              <Button
                variant="contained"
                startIcon={<ShareOutlined />}
                disabled={!shareSectorId || shareBusy}
                onClick={() => void createShare()}
              >
                Compartilhar acesso
              </Button>

              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  Compartilhado com
                </Typography>
                {shareData.shares.length === 0 ? (
                  <Typography color="text.secondary">
                    Este item ainda não foi compartilhado.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {shareData.shares.map((share) => (
                      <Paper key={share.id} variant="outlined" sx={{ p: 1.5 }}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
                        >
                          <Box>
                            <Typography sx={{ fontWeight: 600 }}>
                              {share.targetSector.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {share.targetUser
                                ? `${share.targetUser.name} — ${share.targetUser.email}`
                                : "Toda a secretaria"}
                            </Typography>
                            <Chip
                              size="small"
                              sx={{ mt: 0.75 }}
                              label={
                                share.permission === "DOWNLOAD"
                                  ? "Visualizar e baixar"
                                  : "Somente visualizar"
                              }
                            />
                          </Box>
                          <Button
                            color="error"
                            size="small"
                            disabled={shareBusy}
                            onClick={() => void revokeShare(share.id)}
                          >
                            Revogar
                          </Button>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={shareBusy} onClick={() => setShareItem(null)}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Nova pasta</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Nome da pasta"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!folderName.trim()}
            onClick={() => void createFolder()}
          >
            Criar
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!moveItem}
        onClose={() => setMoveItem(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Mover {moveItem?.name}</DialogTitle>
        <DialogContent>
          <Select
            native
            fullWidth
            value={moveTarget}
            onChange={(event) => setMoveTarget(String(event.target.value))}
            sx={{ mt: 1 }}
          >
            <option value="">Documentos (raiz)</option>
            {allFolders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </Select>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveItem(null)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (!moveItem) return;
              const key = moveItem.kind === "folder" ? "parentId" : "folderId";
              const response = await fetch(
                `/api/${moveItem.kind === "folder" ? "folders" : "documents"}/${moveItem.id}`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "move",
                    [key]: moveTarget || null,
                  }),
                },
              );
              const result = await response.json();
              if (!response.ok) setError(result.error);
              else {
                setMoveItem(null);
                await load();
              }
            }}
          >
            Mover
          </Button>
        </DialogActions>
      </Dialog>
      <DocumentPreview
        document={preview}
        onClose={() => setPreview(null)}
        hideDownload={preview?.shared ? !preview.canDownload : !canDownload}
        {...(preview?.shared && activeSectorId
          ? { targetSectorId: activeSectorId }
          : {})}
      />
    </Stack>
  );
}
