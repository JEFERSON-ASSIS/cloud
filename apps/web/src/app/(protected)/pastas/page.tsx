"use client";
import { useEffect, useMemo, useState } from "react";
import { Folder, OpenInNew } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { formatCuiabaDate } from "@/lib/date";

type FolderItem = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  createdBy?: { name: string };
};
export default function FoldersPage() {
  const [folders, setFolders] = useState<FolderItem[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/files?allFolders=1")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setFolders(body.folders);
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Erro ao carregar pastas.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  const paths = useMemo(() => {
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
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
      }),
    );
  }, [folders]);
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Pastas
        </Typography>
        <Typography color="text.secondary">
          Estrutura real de documentos armazenada no Google Drive.
        </Typography>
      </Box>
      {loading && <LinearProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && folders.length === 0 ? (
        <Card variant="outlined">
          <CardContent sx={{ textAlign: "center", py: 7 }}>
            <Folder color="disabled" sx={{ fontSize: 52 }} />
            <Typography variant="h6">Nenhuma pasta criada</Typography>
            <Typography color="text.secondary">
              Crie a primeira pasta no gerenciador de arquivos.
            </Typography>
          </CardContent>
          <CardActions sx={{ justifyContent: "center", pb: 3 }}>
            <Button variant="contained" href="/arquivos">
              Abrir Arquivos
            </Button>
          </CardActions>
        </Card>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
            gap: 2,
          }}
        >
          {folders.map((folder) => (
            <Card key={folder.id} variant="outlined">
              <CardContent>
                <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
                  <Folder color="primary" />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 650 }} noWrap>
                      {folder.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {paths.get(folder.id)}
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" sx={{ gap: 1, mt: 2 }}>
                  <Chip
                    size="small"
                    label={folder.createdBy?.name ?? "Sistema"}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={formatCuiabaDate(folder.createdAt)}
                  />
                </Stack>
              </CardContent>
              <CardActions>
                <Button
                  endIcon={<OpenInNew />}
                  href={`/arquivos?folderId=${folder.id}`}
                >
                  Abrir pasta
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      )}
    </Stack>
  );
}
