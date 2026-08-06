"use client";
import { useEffect, useState } from "react";
import { Download, InsertDriveFile } from "@mui/icons-material";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";

type PreviewDocument = { id: string; name: string; mimeType?: string };
export function DocumentPreview({
  document,
  onClose,
  hideDownload = false,
}: {
  document: PreviewDocument | null;
  onClose: () => void;
  hideDownload?: boolean;
}) {
  const [loaded, setLoaded] = useState<{ id: string; text: string } | null>(
    null,
  );
  const mime = document?.mimeType ?? "",
    previewableText = mime.startsWith("text/") || mime === "application/json";
  const url = document ? `/api/documents/${document.id}/content` : "";
  useEffect(() => {
    if (!document || !previewableText) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        const value = await response.text();
        if (!response.ok) throw new Error(value);
        if (mime === "application/json") {
          try {
            setLoaded({
              id: document.id,
              text: JSON.stringify(JSON.parse(value), null, 2),
            });
          } catch {
            setLoaded({ id: document.id, text: value });
          }
        } else setLoaded({ id: document.id, text: value });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setLoaded({
            id: document.id,
            text:
              error instanceof Error ? error.message : "Erro ao visualizar.",
          });
      });
    return () => controller.abort();
  }, [document, mime, previewableText, url]);
  return (
    <Dialog open={!!document} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>{document?.name}</DialogTitle>
      <DialogContent dividers sx={{ height: "70vh", p: 0 }}>
        {previewableText && loaded?.id !== document?.id ? (
          <Stack
            sx={{
              height: "100%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CircularProgress />
          </Stack>
        ) : mime.startsWith("image/") ? (
          <Box
            component="img"
            src={url}
            alt={document?.name ?? "Imagem"}
            sx={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : mime === "application/pdf" ? (
          <Box
            component="iframe"
            src={url}
            title={document?.name}
            sx={{ border: 0, width: "100%", height: "100%" }}
          />
        ) : previewableText ? (
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 3,
              whiteSpace: "pre-wrap",
              overflow: "auto",
              height: "100%",
              fontFamily: "monospace",
            }}
          >
            {loaded?.text}
          </Box>
        ) : (
          <Stack
            sx={{
              height: "100%",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            }}
          >
            <InsertDriveFile sx={{ fontSize: 72 }} color="disabled" />
            <Typography>
              Este tipo de arquivo não possui visualização.
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {!hideDownload && (
          <Button
            href={document ? `${url}?download=1` : "#"}
            startIcon={<Download />}
          >
            Download
          </Button>
        )}
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}

