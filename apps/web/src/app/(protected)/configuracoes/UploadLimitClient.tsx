"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { UploadFile, Save } from "@mui/icons-material";

export function UploadLimitClient() {
  const [limitMB, setLimitMB] = useState<number>(100);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; severity: "success" | "error" } | null>(null);

  useEffect(() => {
    fetch("/api/settings/upload-limit")
      .then((res) => res.json())
      .then((data) => {
        if (data.maxUploadSizeMB) setLimitMB(data.maxUploadSizeMB);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/upload-limit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxUploadSizeMB: limitMB }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar.");
      setMsg({ text: "Limite de upload atualizado com sucesso!", severity: "success" });
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Erro ao salvar.", severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="outlined">
      <CardHeader
        avatar={<UploadFile color="primary" />}
        title={<Typography variant="h6">Limite Máximo de Envio por Arquivo</Typography>}
        subheader="Defina o tamanho máximo permitido por arquivo para documentos, PDFs, imagens e projetos (CAD/3D)."
      />
      <CardContent>
        {msg && (
          <Alert severity={msg.severity} sx={{ mb: 2, borderRadius: 2 }} onClose={() => setMsg(null)}>
            {msg.text}
          </Alert>
        )}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
          <TextField
            label="Tamanho limite por arquivo"
            type="number"
            size="small"
            value={limitMB}
            onChange={(e) => setLimitMB(Number(e.target.value))}
            disabled={loading || saving}
            slotProps={{
              input: {
                endAdornment: <InputAdornment position="end">MB</InputAdornment>,
              },
            }}
            helperText="Ex: 100 MB (padrão), 500 MB (projetos grandes), 1000 MB (1 GB)"
            sx={{ minWidth: 280 }}
          />
          <Button
            variant="contained"
            startIcon={<Save />}
            disabled={loading || saving || limitMB <= 0}
            onClick={() => void handleSave()}
            sx={{ borderRadius: 2, px: 3, height: 40 }}
          >
            {saving ? "Salvando..." : "Salvar Limite"}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
