"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  Add,
  Business,
  Delete,
  Edit,
  Group,
  LocationCity,
  People,
  Storage,
} from "@mui/icons-material";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader/PageHeader";
import { StatusChip } from "@/components/StatusChip/StatusChip";

type Organization = {
  id: string;
  name: string;
  document: string | null;
  status: string;
  storageLimit: string;
  _count: {
    users: number;
    documents: number;
    backupRuns: number;
    sectors: number;
  };
  documents: { size: string }[];
};

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Dialog State
  const [openDialog, setOpenDialog] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [storageLimitGB, setStorageLimitGB] = useState(100);
  const [status, setStatus] = useState("ACTIVE");

  const loadOrganizations = async (showProgress = true) => {
    if (showProgress) setLoading(true);
    try {
      const res = await fetch("/api/organizations");
      const data = await res.json();
      if (res.ok) {
        setOrganizations(data);
      } else {
        setError(data.error || "Falha ao carregar empresas.");
      }
    } catch {
      setError("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrganizations(true);
  }, []);

  const handleOpenCreate = () => {
    setEditingOrg(null);
    setName("");
    setDocument("");
    setStorageLimitGB(100);
    setStatus("ACTIVE");
    setOpenDialog(true);
  };

  const handleOpenEdit = (org: Organization) => {
    setEditingOrg(org);
    setName(org.name);
    setDocument(org.document || "");
    setStorageLimitGB(
      Math.round(Number(org.storageLimit) / 1073741824) || 100
    );
    setStatus(org.status);
    setOpenDialog(true);
  };

  const handleSave = async () => {
    setError("");
    try {
      const url = editingOrg
        ? `/api/organizations/${editingOrg.id}`
        : "/api/organizations";
      const method = editingOrg ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          document,
          storageLimitGB,
          status,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(
          editingOrg
            ? "Empresa/Prefeitura atualizada com sucesso!"
            : "Empresa/Prefeitura cadastrada com sucesso!"
        );
        setOpenDialog(false);
        await loadOrganizations(false);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("organization-updated"));
        }
      } else {
        setError(data.error || "Erro ao salvar empresa.");
      }
    } catch {
      setError("Erro de comunicação com o servidor.");
    }
  };

  const handleDelete = async (id: string, orgName: string) => {
    if (
      !confirm(
        `Tem certeza que deseja excluir a empresa/prefeitura "${orgName}"?`
      )
    ) {
      return;
    }

    setError("");
    try {
      const res = await fetch(`/api/organizations/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Empresa/Prefeitura excluída.");
        await loadOrganizations(false);
      } else {
        setError(data.error || "Erro ao excluir.");
      }
    } catch {
      setError("Erro ao se conectar ao servidor.");
    }
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Empresas & Prefeituras"
        description="Gestão de organizações, secretarias municipais, cotas de armazenamento e permissões de usuários."
        action={
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleOpenCreate}
            size="large"
          >
            Nova Prefeitura / Empresa
          </Button>
        }
      />

      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {loading ? (
        <LinearProgress />
      ) : (
        <Grid container spacing={3}>
          {organizations.map((org) => {
            const usedBytes = org.documents
              ? org.documents.reduce((sum, doc) => sum + Number(doc.size), 0)
              : 0;
            const usedGB = (usedBytes / 1073741824).toFixed(2);
            const limitGB = (
              Number(org.storageLimit) / 1073741824
            ).toFixed(0);
            const usagePercent = Math.min(
              100,
              Math.round((usedBytes / Number(org.storageLimit)) * 100) || 0
            );

            return (
              <Grid key={org.id} size={{ xs: 12, md: 6, xl: 4 }}>
                <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 2,
                            bgcolor: "primary.light",
                            color: "primary.main",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <LocationCity />
                        </Box>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                            {org.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            CNPJ/Doc: {org.document || "Não informado"}
                          </Typography>
                        </Box>
                      </Stack>
                      <StatusChip status={org.status} />
                    </Stack>

                    <Grid container spacing={2} sx={{ mt: 2 }}>
                      <Grid size={6}>
                        <Box sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            Secretarias
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            {org._count.sectors ?? 0}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid size={6}>
                        <Box sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            Usuários/Membros
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            {org._count.users}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid size={6}>
                        <Box sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            Documentos
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            {org._count.documents}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid size={6}>
                        <Box sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            Execuções de Backup
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            {org._count.backupRuns}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>

                    <Box sx={{ mt: 2.5 }}>
                      <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Armazenamento em Nuvem
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                          {usedGB} GB / {limitGB} GB ({usagePercent}%)
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={usagePercent}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>
                  </CardContent>

                  <CardActions sx={{ justifyContent: "space-between", px: 2, pb: 2, borderTop: 1, borderColor: "divider" }}>
                    <Stack direction="row" spacing={1}>
                      <Button
                        component={Link}
                        href="/secretarias"
                        size="small"
                        variant="outlined"
                        startIcon={<Business />}
                      >
                        Secretarias
                      </Button>
                      <Button
                        component={Link}
                        href="/usuarios"
                        size="small"
                        variant="outlined"
                        startIcon={<People />}
                      >
                        Usuários
                      </Button>
                    </Stack>

                    <Stack direction="row">
                      <IconButton size="small" onClick={() => handleOpenEdit(org)} title="Editar">
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => void handleDelete(org.id, org.name)}
                        title="Excluir"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Stack>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Dialog Modal para Criar / Editar Prefeitura ou Empresa */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingOrg ? "Editar Prefeitura / Empresa" : "Cadastrar Nova Prefeitura / Empresa"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Nome da Prefeitura ou Empresa"
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Prefeitura Municipal de Nova Iguaçu"
              required
            />
            <TextField
              label="CNPJ ou Documento de Identificação"
              fullWidth
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              placeholder="Ex: 00.000.000/0001-00"
            />
            <Grid container spacing={2}>
              <Grid size={6}>
                <TextField
                  label="Cota de Armazenamento (GB)"
                  type="number"
                  fullWidth
                  value={storageLimitGB}
                  onChange={(e) => setStorageLimitGB(Number(e.target.value))}
                  helperText="Limite máximo de dados em nuvem"
                />
              </Grid>
              <Grid size={6}>
                <Select
                  fullWidth
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <MenuItem value="ACTIVE">Ativo (Permitir backups/arquivos)</MenuItem>
                  <MenuItem value="SUSPENDED">Suspenso</MenuItem>
                  <MenuItem value="INACTIVE">Inativo</MenuItem>
                </Select>
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button variant="contained" disabled={!name.trim()} onClick={() => void handleSave()}>
            Salvar Prefeitura / Empresa
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
