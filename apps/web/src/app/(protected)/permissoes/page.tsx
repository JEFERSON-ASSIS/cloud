"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Save } from "@mui/icons-material";
import { PageHeader } from "@/components/PageHeader/PageHeader";
import { editableRoleNames, type MenuKey } from "@/lib/nav-items";

type CatalogItem = {
  key: MenuKey;
  label: string;
  href: string;
  assignable: boolean;
};

type MatrixResponse = {
  catalog: CatalogItem[];
  roles: typeof editableRoleNames[number][];
  matrix: Record<string, string[]>;
  error?: string;
};

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gestor",
  OPERATOR: "Operador",
  VIEWER: "Visualizador",
};

export default function PermissoesPage() {
  const { data: session } = useSession();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/roles/menu-permissions");
      const body = (await res.json()) as MatrixResponse;
      if (!res.ok) {
        setError(body.error || "Não foi possível carregar as permissões de menu.");
        return;
      }
      setCatalog(body.catalog.filter((item) => item.assignable));
      setMatrix(body.matrix);
    } catch {
      setError("Erro ao carregar permissões de menu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) void load();
    else setLoading(false);
  }, [isSuperAdmin, load]);

  const roles = useMemo(() => [...editableRoleNames], []);

  const toggle = (roleName: string, menuKey: string) => {
    setMatrix((current) => {
      const currentKeys = new Set(current[roleName] ?? []);
      if (currentKeys.has(menuKey)) currentKeys.delete(menuKey);
      else currentKeys.add(menuKey);
      return { ...current, [roleName]: Array.from(currentKeys) };
    });
    setMessage("");
  };

  const saveRole = async (roleName: string) => {
    setSavingRole(roleName);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/roles/${roleName}/menu-permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuKeys: matrix[roleName] ?? [] }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || `Falha ao salvar perfil ${roleName}.`);
        return;
      }
      setMessage(
        `Menu do perfil ${roleLabels[roleName] ?? roleName} salvo. Os usuários desse perfil precisam relogar para ver a alteração.`,
      );
    } catch {
      setError(`Erro ao salvar perfil ${roleName}.`);
    } finally {
      setSavingRole(null);
    }
  };

  if (!isSuperAdmin) {
    return (
      <Stack spacing={2}>
        <PageHeader
          title="Permissões de menu"
          description="Controle quais itens do menu cada perfil pode visualizar."
        />
        <Alert severity="warning">
          Apenas Super Administradores podem acessar esta tela.
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Permissões de menu"
        description="Selecione quais itens do menu cada perfil pode ver. Empresas e Permissões permanecem exclusivos do Super Admin."
      />

      <Alert severity="info">
        As alterações de menu entram em vigor no próximo login do usuário do perfil.
      </Alert>

      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity="success" onClose={() => setMessage("")}>
          {message}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper variant="outlined" sx={{ overflow: "auto" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, minWidth: 180 }}>Item do menu</TableCell>
                {roles.map((roleName) => (
                  <TableCell key={roleName} align="center" sx={{ fontWeight: 700, minWidth: 140 }}>
                    <Stack spacing={1} sx={{ alignItems: "center" }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {roleLabels[roleName] ?? roleName}
                      </Typography>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<Save />}
                        disabled={savingRole === roleName}
                        onClick={() => void saveRole(roleName)}
                      >
                        {savingRole === roleName ? "Salvando..." : "Salvar"}
                      </Button>
                    </Stack>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {catalog.map((item) => (
                <TableRow key={item.key} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.href}
                    </Typography>
                  </TableCell>
                  {roles.map((roleName) => {
                    const checked = (matrix[roleName] ?? []).includes(item.key);
                    return (
                      <TableCell key={`${roleName}-${item.key}`} align="center">
                        <Checkbox
                          checked={checked}
                          onChange={() => toggle(roleName, item.key)}
                          slotProps={{
                            input: {
                              "aria-label": `${item.label} para ${roleName}`,
                            },
                          }}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Stack>
  );
}
