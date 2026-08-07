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
  Tab,
  Tabs,
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
import type { PermissionCatalogItem } from "@/lib/permission-catalog";

type MenuCatalogItem = {
  key: MenuKey;
  label: string;
  href: string;
  assignable: boolean;
};

type MatrixResponse<T> = {
  catalog: T[];
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

type TabKey = "menu" | "api";

export default function PermissoesPage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<TabKey>("menu");

  const [menuCatalog, setMenuCatalog] = useState<MenuCatalogItem[]>([]);
  const [menuMatrix, setMenuMatrix] = useState<Record<string, string[]>>({});
  const [permCatalog, setPermCatalog] = useState<PermissionCatalogItem[]>([]);
  const [permMatrix, setPermMatrix] = useState<Record<string, string[]>>({});

  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  const roles = useMemo(() => [...editableRoleNames], []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [menuRes, permRes] = await Promise.all([
        fetch("/api/roles/menu-permissions"),
        fetch("/api/roles/permissions"),
      ]);
      const menuBody = (await menuRes.json()) as MatrixResponse<MenuCatalogItem>;
      const permBody = (await permRes.json()) as MatrixResponse<PermissionCatalogItem>;

      if (!menuRes.ok) {
        setError(menuBody.error || "Não foi possível carregar as permissões de menu.");
        return;
      }
      if (!permRes.ok) {
        setError(permBody.error || "Não foi possível carregar as permissões de API.");
        return;
      }

      setMenuCatalog(menuBody.catalog.filter((item) => item.assignable));
      setMenuMatrix(menuBody.matrix);
      setPermCatalog(permBody.catalog);
      setPermMatrix(permBody.matrix);
    } catch {
      setError("Erro ao carregar permissões.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) void load();
    else setLoading(false);
  }, [isSuperAdmin, load]);

  const toggleMenu = (roleName: string, menuKey: string) => {
    setMenuMatrix((current) => {
      const currentKeys = new Set(current[roleName] ?? []);
      if (currentKeys.has(menuKey)) currentKeys.delete(menuKey);
      else currentKeys.add(menuKey);
      return { ...current, [roleName]: Array.from(currentKeys) };
    });
    setMessage("");
  };

  const togglePerm = (roleName: string, permissionKey: string) => {
    setPermMatrix((current) => {
      const currentKeys = new Set(current[roleName] ?? []);
      if (currentKeys.has(permissionKey)) currentKeys.delete(permissionKey);
      else currentKeys.add(permissionKey);
      return { ...current, [roleName]: Array.from(currentKeys) };
    });
    setMessage("");
  };

  const saveMenuRole = async (roleName: string) => {
    setSavingRole(`menu:${roleName}`);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/roles/${roleName}/menu-permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuKeys: menuMatrix[roleName] ?? [] }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || `Falha ao salvar menu do perfil ${roleName}.`);
        return;
      }
      setMessage(
        `Menu do perfil ${roleLabels[roleName] ?? roleName} salvo. Os usuários desse perfil precisam relogar.`,
      );
    } catch {
      setError(`Erro ao salvar menu do perfil ${roleName}.`);
    } finally {
      setSavingRole(null);
    }
  };

  const savePermRole = async (roleName: string) => {
    setSavingRole(`api:${roleName}`);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/roles/${roleName}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionKeys: permMatrix[roleName] ?? [] }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || `Falha ao salvar permissões do perfil ${roleName}.`);
        return;
      }
      setMessage(
        `Permissões do perfil ${roleLabels[roleName] ?? roleName} salvas. Os usuários desse perfil precisam relogar.`,
      );
    } catch {
      setError(`Erro ao salvar permissões do perfil ${roleName}.`);
    } finally {
      setSavingRole(null);
    }
  };

  if (!isSuperAdmin) {
    return (
      <Stack spacing={2}>
        <PageHeader
          title="Permissões"
          description="Controle o menu e as permissões de API de cada perfil."
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
        title="Permissões"
        description="Menu controla o que aparece na lateral. Permissões de API controlam o que o perfil pode fazer de fato (upload, usuários, backups, etc.)."
      />

      <Alert severity="info">
        Alterações entram em vigor no próximo login do usuário do perfil. Empresas e a
        própria tela de Permissões permanecem exclusivos do Super Admin.
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

      <Tabs
        value={tab}
        onChange={(_, value: TabKey) => setTab(value)}
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Tab value="menu" label="Itens do menu" />
        <Tab value="api" label="Permissões de API" />
      </Tabs>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : tab === "menu" ? (
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
                        disabled={savingRole === `menu:${roleName}`}
                        onClick={() => void saveMenuRole(roleName)}
                      >
                        {savingRole === `menu:${roleName}` ? "Salvando..." : "Salvar"}
                      </Button>
                    </Stack>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {menuCatalog.map((item) => (
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
                    const checked = (menuMatrix[roleName] ?? []).includes(item.key);
                    return (
                      <TableCell key={`${roleName}-${item.key}`} align="center">
                        <Checkbox
                          checked={checked}
                          onChange={() => toggleMenu(roleName, item.key)}
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
      ) : (
        <Paper variant="outlined" sx={{ overflow: "auto" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, minWidth: 220 }}>Permissão</TableCell>
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
                        disabled={savingRole === `api:${roleName}`}
                        onClick={() => void savePermRole(roleName)}
                      >
                        {savingRole === `api:${roleName}` ? "Salvando..." : "Salvar"}
                      </Button>
                    </Stack>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {permCatalog.map((item) => (
                <TableRow key={item.key} hover>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {item.group}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      {`${item.key} — ${item.description}`}
                    </Typography>
                  </TableCell>
                  {roles.map((roleName) => {
                    const checked = (permMatrix[roleName] ?? []).includes(item.key);
                    return (
                      <TableCell key={`${roleName}-${item.key}`} align="center">
                        <Checkbox
                          checked={checked}
                          onChange={() => togglePerm(roleName, item.key)}
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
