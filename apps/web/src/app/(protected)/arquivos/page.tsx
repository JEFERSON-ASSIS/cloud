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
  CheckCircle,
  Close,
  CloudUpload,
  Delete,
  Download,
  Error as ErrorIcon,
  Folder,
  GridView,
  InsertDriveFile,
  List,
  MoreVert,
  Restore,
  Schedule,
  Upload,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
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
import { useSearchParams } from "next/navigation";

type Item = {
  id: string;
  kind: "folder" | "document";
  name: string;
  size?: string;
  mimeType?: string;
  updatedAt: string;
};
type Listing = {
  breadcrumbs: { id: string; name: string }[];
  folders: Item[];
  documents: Item[];
};

type UploadStatus = "pending" | "uploading" | "done" | "error";

type UploadJob = {
  id: string;
  name: string;
  size: number;
  status: UploadStatus;
  progress: number;
  error?: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesPage() {
  const { activeOrganizationId, activeSectorId } = useActiveTenant();
  const query = useSearchParams();
  const [folderId, setFolderId] = useState<string | null>(
      query.get("folderId"),
    ),
    [data, setData] = useState<Listing>({
      breadcrumbs: [],
      folders: [],
      documents: [],
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [trash, setTrash] = useState(false),
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
  const input = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);

  const load = useCallback(async () => {
    setBusy(true);
    const p = new URLSearchParams();
    if (folderId) p.set("folderId", folderId);
    if (search) p.set("search", search);
    if (trash) p.set("trash", "1");
    const activeOrgId = activeOrganizationId;
    if (activeOrgId) p.set("organizationId", activeOrgId);
    if (activeSectorId) p.set("sectorId", activeSectorId);

    try {
      const r = await fetch(`/api/files?${p}`);
      const b = await r.json();
      if (r.ok) {
        setData(b);
        setIsReadOnly(b.isReadOnly ?? false);
        setCanDownload(b.canDownload ?? !(b.isReadOnly ?? false));
      } else {
        setError(b.error);
      }
    } catch {
      setError("Erro ao carregar arquivos.");
    } finally {
      setBusy(false);
    }
  }, [folderId, search, trash, activeOrganizationId, activeSectorId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const handleOrgChange = () => void load();
    window.addEventListener("active-org-changed", handleOrgChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("active-org-changed", handleOrgChange);
    };
  }, [load]);

  useEffect(() => {
    const handleSectorChange = () => {
      setFolderId(null);
      void load();
    };
    window.addEventListener("active-sector-changed", handleSectorChange);
    return () => window.removeEventListener("active-sector-changed", handleSectorChange);
  }, [load]);

  const patchUploadJob = (id: string, patch: Partial<UploadJob>) => {
    setUploadQueue((current) =>
      current.map((job) => (job.id === id ? { ...job, ...patch } : job)),
    );
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const selected = Array.from(files);
    if (!selected.length) return;
    if (uploadingRef.current) {
      setError("Aguarde o envio atual terminar para adicionar mais arquivos.");
      return;
    }

    const jobs: UploadJob[] = selected.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      size: file.size,
      status: "pending",
      progress: 0,
    }));

    setUploadQueue(jobs);
    setUploadPanelOpen(true);
    uploadingRef.current = true;

    let hadSuccess = false;
    for (let i = 0; i < selected.length; i += 1) {
      const file = selected[i]!;
      const job = jobs[i]!;
      patchUploadJob(job.id, { status: "uploading", progress: 0, error: undefined });

      const body = new FormData();
      body.set("file", file);
      if (folderId) body.set("folderId", folderId);
      if (activeSectorId) body.set("sectorId", activeSectorId);
      if (activeOrganizationId) body.set("organizationId", activeOrganizationId);

      try {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/documents/upload");
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              patchUploadJob(job.id, {
                progress: Math.round((event.loaded / event.total) * 100),
              });
            }
          };
          xhr.onload = () => {
            let result: { error?: string } = {};
            try {
              result = JSON.parse(xhr.responseText || "{}") as { error?: string };
            } catch {
              result = {};
            }
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(result.error ?? "Falha no upload."));
          };
          xhr.onerror = () =>
            reject(new Error("Erro de conexão durante o upload."));
          xhr.send(body);
        });
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

  const action = async (item: Item, kind: string) => {
    setMenu(null);
    if (kind === "download") {
      window.open(`/api/documents/${item.id}/content?download=1`, "_self");
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
  const drop = (e: DragEvent) => {
    e.preventDefault();
    if (!isReadOnly) void uploadFiles(e.dataTransfer.files);
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
            <Button size="small" onClick={() => setFolderId(null)}>
              Documentos
            </Button>
            {data.breadcrumbs.map((x) => (
              <Button size="small" key={x.id} onClick={() => setFolderId(x.id)}>
                {x.name}
              </Button>
            ))}
          </Breadcrumbs>
        </Box>
        {!isReadOnly && (
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
            <input
              hidden
              multiple
              ref={input}
              type="file"
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
      {uploadPanel.length > 0 && uploadPanelOpen && (
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
                          title={job.name}
                        >
                          {job.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatBytes(job.size)}
                          {job.status === "pending" && " · Na fila"}
                          {job.status === "uploading" && ` · Enviando ${job.progress}%`}
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
                              ? "Enviando"
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
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar arquivos e pastas"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button
          color={trash ? "warning" : "inherit"}
          onClick={() => {
            setTrash(!trash);
            setFolderId(null);
          }}
        >
          {trash ? "Voltar" : "Lixeira"}
        </Button>
        <Tooltip title={grid ? "Exibir em lista" : "Exibir em grade"}>
          <IconButton onClick={() => setGrid(!grid)}>
            {grid ? <List /> : <GridView />}
          </IconButton>
        </Tooltip>
      </Stack>
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
              {trash ? "A lixeira está vazia" : "Arraste arquivos para cá"}
            </Typography>
            <Typography color="text.secondary">
              Ou use os botões acima para começar.
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
                  onDoubleClick={() =>
                    item.kind === "folder"
                      ? setFolderId(item.id)
                      : void action(item, "preview")
                  }
                >
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
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenu({ anchor: e.currentTarget, item });
                    }}
                  >
                    <MoreVert />
                  </IconButton>
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
        {!isReadOnly && !trash && menu?.item.kind === "document" && (
          <MenuItem onClick={() => void action(menu.item, "download")}>
            <Download fontSize="small" /> Baixar
          </MenuItem>
        )}
        {!isReadOnly && !trash && (
          <MenuItem onClick={() => menu && void action(menu.item, "rename")}>
            Renomear
          </MenuItem>
        )}
        {!isReadOnly && !trash && (
          <MenuItem onClick={() => menu && void action(menu.item, "move")}>
            Mover
          </MenuItem>
        )}
        {!isReadOnly && (
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
      <DocumentPreview document={preview} onClose={() => setPreview(null)} hideDownload={!canDownload} />
    </Stack>
  );
}
