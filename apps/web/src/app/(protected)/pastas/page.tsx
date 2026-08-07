"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Folder,
  FolderOpen,
  OpenInNew,
  Search,
  CalendarToday,
  Person,
  AccountTree,
} from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  InputAdornment,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { PageHeader } from "@/components/PageHeader/PageHeader";
import { formatCuiabaDate } from "@/lib/date";

type FolderItem = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  createdBy?: { name: string };
};

const FOLDER_COLORS = [
  "#4285F4", // Google Blue
  "#EA4335", // Google Red
  "#FBBC04", // Google Yellow
  "#34A853", // Google Green
  "#9C27B0", // Purple
  "#00ACC1", // Cyan
  "#FF7043", // Deep Orange
  "#5C6BC0", // Indigo
];

function FolderCardSkeleton() {
  return (
    <Paper
      elevation={0}
      sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}
    >
      <Box sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 2 }}>
          <Skeleton variant="rounded" width={44} height={44} sx={{ borderRadius: 2 }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton width="65%" height={22} />
            <Skeleton width="85%" height={16} />
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Skeleton width={90} height={24} sx={{ borderRadius: 4 }} />
          <Skeleton width={80} height={24} sx={{ borderRadius: 4 }} />
        </Stack>
      </Box>
      <Divider />
      <Box sx={{ px: 2.5, py: 1.5 }}>
        <Skeleton width={100} height={20} />
      </Box>
    </Paper>
  );
}

export default function FoldersPage() {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/files?allFolders=1")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setFolders(body.folders);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Erro ao carregar pastas.")
      )
      .finally(() => setLoading(false));
  }, []);

  const paths = useMemo(() => {
    const byId = new Map(folders.map((f) => [f.id, f]));
    return new Map(
      folders.map((folder) => {
        const names = [folder.name];
        let parentId = folder.parentId;
        for (let depth = 0; parentId && depth < 50; depth += 1) {
          const parent = byId.get(parentId);
          if (!parent) break;
          names.unshift(parent.name);
          parentId = parent.parentId;
        }
        return [folder.id, names.join(" / ")];
      })
    );
  }, [folders]);

  const rootFolders = useMemo(() => folders.filter((f) => !f.parentId), [folders]);
  const subFolders = useMemo(() => folders.filter((f) => f.parentId), [folders]);

  const filteredFolders = useMemo(() => {
    if (!search.trim()) return folders;
    const q = search.toLowerCase();
    return folders.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.createdBy?.name ?? "").toLowerCase().includes(q) ||
        (paths.get(f.id) ?? "").toLowerCase().includes(q)
    );
  }, [folders, search, paths]);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Pastas"
        description="Estrutura de pastas e documentos armazenada na nuvem."
        action={
          <Button
            variant="contained"
            href="/arquivos"
            endIcon={<OpenInNew />}
            sx={{ borderRadius: 2, px: 3, fontWeight: 600 }}
          >
            Abrir Arquivos
          </Button>
        }
      />

      {error && (
        <Alert severity="error" onClose={() => setError("")} sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Summary + Search row */}
      {!loading && folders.length > 0 && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
          <Stack direction="row" spacing={2} sx={{ flex: 1 }}>
            {[
              { label: "Pastas raiz", value: rootFolders.length, color: "#4285F4", icon: <Folder sx={{ fontSize: 18 }} /> },
              { label: "Subpastas", value: subFolders.length, color: "#34A853", icon: <AccountTree sx={{ fontSize: 18 }} /> },
              { label: "Total", value: folders.length, color: "#9C27B0", icon: <FolderOpen sx={{ fontSize: 18 }} /> },
            ].map((stat) => (
              <Paper
                key={stat.label}
                elevation={0}
                sx={{
                  borderRadius: 2.5,
                  border: "1px solid",
                  borderColor: "divider",
                  px: 2,
                  py: 1.25,
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  flex: 1,
                }}
              >
                <Avatar sx={{ bgcolor: stat.color + "20", color: stat.color, width: 34, height: 34 }}>
                  {stat.icon}
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1 }}>
                    {stat.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stat.label}
                  </Typography>
                </Box>
              </Paper>
            ))}
          </Stack>

          <TextField
            placeholder="Buscar pastas..."
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ fontSize: 18, color: "text.disabled" }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ minWidth: 220, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
          />
        </Stack>
      )}

      {/* Cards */}
      {loading ? (
        <Grid container spacing={2.5}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
              <FolderCardSkeleton />
            </Grid>
          ))}
        </Grid>
      ) : filteredFolders.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            border: "2px dashed",
            borderColor: "divider",
            p: { xs: 6, md: 10 },
            textAlign: "center",
          }}
        >
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #4285F420, #34A85320)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 2,
            }}
          >
            <Folder sx={{ fontSize: 34, color: "#4285F4" }} />
          </Box>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
            {search ? "Nenhuma pasta encontrada" : "Nenhuma pasta criada"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 340, mx: "auto" }}>
            {search
              ? `Não encontramos pastas com "${search}". Tente outro termo.`
              : "Crie a primeira pasta no gerenciador de arquivos e ela aparecerá aqui."}
          </Typography>
          {!search && (
            <Button
              variant="contained"
              href="/arquivos"
              endIcon={<OpenInNew />}
              sx={{ borderRadius: 2, px: 4 }}
            >
              Abrir Gerenciador de Arquivos
            </Button>
          )}
        </Paper>
      ) : (
        <Grid container spacing={2.5}>
          {filteredFolders.map((folder, idx) => {
            const color = FOLDER_COLORS[idx % FOLDER_COLORS.length];
            const fullPath = paths.get(folder.id) ?? folder.name;
            const isRoot = !folder.parentId;

            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={folder.id}>
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: 3,
                    border: "1px solid",
                    borderColor: "divider",
                    overflow: "hidden",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      transform: "translateY(-3px)",
                      boxShadow: `0 8px 30px ${color}25`,
                      borderColor: color + "60",
                    },
                  }}
                >
                  {/* Colored top stripe */}
                  <Box sx={{ height: 4, bgcolor: color }} />

                  <Box sx={{ p: 2.5, flex: 1 }}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: 2,
                          bgcolor: color + "15",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Folder sx={{ color, fontSize: 24 }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Tooltip title={folder.name} placement="top">
                          <Typography noWrap sx={{ fontWeight: 700, fontSize: 15 }}>
                            {folder.name}
                          </Typography>
                        </Tooltip>
                        <Tooltip title={fullPath} placement="bottom">
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            sx={{ display: "block", maxWidth: "100%" }}
                          >
                            {fullPath}
                          </Typography>
                        </Tooltip>
                      </Box>
                      {isRoot && (
                        <Chip
                          label="Raiz"
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: 10,
                            bgcolor: color + "15",
                            color,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </Stack>

                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                      <Chip
                        icon={<Person sx={{ fontSize: "14px !important" }} />}
                        size="small"
                        label={folder.createdBy?.name ?? "Sistema"}
                        variant="outlined"
                        sx={{ borderRadius: 1.5, fontSize: 11 }}
                      />
                      <Chip
                        icon={<CalendarToday sx={{ fontSize: "12px !important" }} />}
                        size="small"
                        label={formatCuiabaDate(folder.createdAt)}
                        variant="outlined"
                        sx={{ borderRadius: 1.5, fontSize: 11 }}
                      />
                    </Stack>
                  </Box>

                  <Divider />

                  <Box
                    sx={{
                      px: 2,
                      py: 1.25,
                      display: "flex",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      bgcolor: "action.hover",
                    }}
                  >
                    <Button
                      size="small"
                      endIcon={<OpenInNew sx={{ fontSize: "14px !important" }} />}
                      href={`/arquivos?folderId=${folder.id}`}
                      sx={{
                        borderRadius: 1.5,
                        fontSize: 12,
                        fontWeight: 600,
                        color,
                        "&:hover": { bgcolor: color + "12" },
                      }}
                    >
                      Abrir pasta
                    </Button>
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Stack>
  );
}
