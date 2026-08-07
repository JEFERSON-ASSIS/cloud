"use client";

import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  InputBase,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Toolbar,
  Tooltip,
  Typography,
  useColorScheme,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  DashboardOutlined,
  FolderOutlined,
  BackupOutlined,
  ScheduleOutlined,
  DnsOutlined,
  HubOutlined,
  PeopleOutlined,
  BusinessOutlined,
  FactCheckOutlined,
  ReceiptLongOutlined,
  SettingsOutlined,
  Menu as MenuIcon,
  Search,
  NotificationsNone,
  LightMode,
  DarkMode,
  Logout,
  ChevronLeft,
  FolderCopyOutlined,
  Apartment,
} from "@mui/icons-material";
import type { ReactNode } from "react";
import type { Permission } from "@i7ai/types";
import { ActiveTenantContext } from "./ActiveTenantContext";

const expandedWidth = 264;
const collapsedWidth = 76;

type MenuItemType = {
  label: string;
  href: string;
  icon: ReactNode;
  permission?: Permission;
  superAdminOnly?: boolean;
};

const navItems: MenuItemType[] = [
  { label: "Dashboard", href: "/dashboard", icon: <DashboardOutlined key="d" />, permission: "dashboard.read" },
  { label: "Secretarias", href: "/secretarias", icon: <Apartment key="sec" />, permission: "organization.read" },
  { label: "Arquivos", href: "/arquivos", icon: <FolderOutlined key="a" />, permission: "document.read" },
  { label: "Pastas", href: "/pastas", icon: <FolderCopyOutlined key="p" />, permission: "document.read" },
  { label: "Backups", href: "/backups", icon: <BackupOutlined key="b" />, permission: "backup.read" },
  { label: "Agendamentos", href: "/agendamentos", icon: <ScheduleOutlined key="ag" />, permission: "backup.read" },
  { label: "Servidores", href: "/servidores", icon: <DnsOutlined key="s" />, permission: "integration.manage" },
  { label: "Integrações", href: "/integracoes", icon: <HubOutlined key="i" />, permission: "integration.manage" },
  { label: "Usuários", href: "/usuarios", icon: <PeopleOutlined key="u" />, permission: "user.read" },
  { label: "Empresas", href: "/empresas", icon: <BusinessOutlined key="e" />, permission: "organization.manage", superAdminOnly: true },
  { label: "Auditoria", href: "/auditoria", icon: <FactCheckOutlined key="au" />, permission: "audit.read" },
  { label: "Logs", href: "/logs", icon: <ReceiptLongOutlined key="l" />, permission: "audit.read" },
  { label: "Configurações", href: "/configuracoes", icon: <SettingsOutlined key="c" />, permission: "organization.read" },
];

type OrganizationOption = {
  id: string;
  name: string;
};

export function AppShell({ children }: PropsWithChildren) {
  const theme = useTheme();
  const { mode, systemMode, setMode } = useColorScheme();
  const effectiveMode = mode === "system" ? systemMode : mode;
  const mobile = useMediaQuery(theme.breakpoints.down("md"));
  const pathname = usePathname();
  const { data } = useSession();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("sidebar-collapsed") === "true"
  );

  const [sectors, setSectors] = useState<{ id: string; name: string }[]>([]);
  const [activeSectorId, setActiveSectorId] = useState<string>("");

  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string>(() =>
    typeof window !== "undefined" ? localStorage.getItem("active-org-id") ?? "" : ""
  );

  const userRole = data?.user?.role;
  const userPermissions = data?.user?.permissions ?? [];

  // Filtragem dinâmica de menus por permissão e perfil
  const filteredNavItems = navItems.filter((item) => {
    if (userRole === "SUPER_ADMIN") return true;
    if (item.superAdminOnly) return false;
    if (!item.permission) return true;
    return userPermissions.includes(item.permission);
  });

  const fetchOrganizations = useCallback(() => {
    fetch("/api/organizations")
      .then((res) => res.json())
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          setOrganizations(
            list.map((item) => ({ id: item.id, name: item.name }))
          );
          const current = list.find((o) => o.id === activeOrgId)
            ?? list.find((o) => o.id === data?.user?.organizationId)
            ?? list[0];
          if (current.id !== activeOrgId) setActiveOrgId(current.id);
          localStorage.setItem("active-org-id", current.id);
        }
      })
      .catch(() => {});
  }, [activeOrgId, data?.user?.organizationId]);

  useEffect(() => {
    fetchOrganizations();
    const handleOrgUpdate = () => fetchOrganizations();
    window.addEventListener("organization-updated", handleOrgUpdate);
    return () => {
      window.removeEventListener("organization-updated", handleOrgUpdate);
    };
  }, [fetchOrganizations]);

  useEffect(() => {
    const orgId = activeOrgId || data?.user?.organizationId;
    if (orgId) {
      fetch(`/api/sectors?organizationId=${orgId}`)
        .then((res) => res.json())
        .then((list) => {
          if (Array.isArray(list)) {
            setSectors(list);
            const saved = localStorage.getItem("active-sector-id");
            const found = list.find((s) => s.id === saved) || list[0];
            if (found) {
              setActiveSectorId(found.id);
              localStorage.setItem("active-sector-id", found.id);
            } else {
              setActiveSectorId("");
              localStorage.removeItem("active-sector-id");
            }
            window.dispatchEvent(new Event("active-sector-changed"));
          }
        })
        .catch(() => {});
    }
  }, [activeOrgId, data?.user?.organizationId]);

  const handleOrgChange = (id: string) => {
    setActiveOrgId(id);
    localStorage.setItem("active-org-id", id);
    setActiveSectorId("");
    localStorage.removeItem("active-sector-id");
    window.dispatchEvent(new Event("active-org-changed"));
  };

  const handleSectorChange = (id: string) => {
    setActiveSectorId(id);
    localStorage.setItem("active-sector-id", id);
    window.dispatchEvent(new Event("active-sector-changed"));
  };

  const width = collapsed ? collapsedWidth : expandedWidth;
  const toggleCollapsed = () =>
    setCollapsed((value) => {
      localStorage.setItem("sidebar-collapsed", String(!value));
      return !value;
    });

  const drawerContent = (
    <Box
      sx={{
        bgcolor: "#0b132b",
        color: "white",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Toolbar
        sx={{
          justifyContent: collapsed ? "center" : "flex-start",
          px: 2,
          minHeight: "64px !important",
        }}
      >
        <Typography
          variant="h6"
          noWrap
          sx={{
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: 0.5,
            color: "white",
          }}
        >
          {collapsed ? "i7" : "i7AI Cloud"}
        </Typography>
      </Toolbar>

      <Divider sx={{ borderColor: "rgba(255,255,255,.08)" }} />

      <List sx={{ p: 1.25, flex: 1, overflowY: "auto" }}>
        {filteredNavItems.map(({ label, href, icon }) => (
          <Tooltip key={href} title={collapsed ? label : ""} placement="right">
            <ListItemButton
              component={Link}
              href={href}
              selected={pathname === href}
              onClick={() => setOpen(false)}
              sx={{
                borderRadius: 2.5,
                mb: 0.4,
                minHeight: 46,
                "&.Mui-selected": {
                  bgcolor: "rgba(37,99,235,.22)",
                  color: "white",
                },
                "&:hover": { bgcolor: "rgba(255,255,255,.07)" },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: collapsed ? 0 : 42,
                  color: "inherit",
                  justifyContent: "center",
                }}
              >
                {icon}
              </ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary={
                    <Typography sx={{ fontSize: 14, fontWeight: 550 }}>
                      {label}
                    </Typography>
                  }
                />
              )}
            </ListItemButton>
          </Tooltip>
        ))}
      </List>

      <Divider sx={{ borderColor: "rgba(255,255,255,.08)" }} />

      {/* Botão Sair mantido na Sidebar */}
      <Box sx={{ p: 1.25, flexShrink: 0 }}>
        <Tooltip title={collapsed ? "Sair da Conta" : ""} placement="right">
          <ListItemButton
            onClick={() => signOut({ callbackUrl: "/login" })}
            sx={{
              borderRadius: 2.5,
              minHeight: 46,
              color: "#EF4444",
              "&:hover": {
                bgcolor: "rgba(239, 68, 68, 0.12)",
                color: "#F87171",
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: collapsed ? 0 : 42,
                color: "inherit",
                justifyContent: "center",
              }}
            >
              <Logout fontSize="small" />
            </ListItemIcon>
            {!collapsed && (
              <ListItemText
                primary={
                  <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                    Sair
                  </Typography>
                }
                secondary={
                  <Typography
                    noWrap
                    sx={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}
                  >
                    {data?.user?.email}
                  </Typography>
                }
              />
            )}
          </ListItemButton>
        </Tooltip>

        {!mobile && (
          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
            <IconButton
              aria-label="Recolher menu"
              onClick={toggleCollapsed}
              sx={{
                color: "rgba(255,255,255,0.5)",
                transform: collapsed ? "rotate(180deg)" : "none",
              }}
            >
              <ChevronLeft />
            </IconButton>
          </Box>
        )}
      </Box>
    </Box>
  );

  return (
    <ActiveTenantContext.Provider
      value={{
        organizations,
        sectors: sectors.map((sector) => ({ ...sector, organizationId: activeOrgId })),
        activeOrganizationId: activeOrgId || data?.user?.organizationId || "",
        activeSectorId,
        setActiveOrganizationId: handleOrgChange,
        setActiveSectorId: handleSectorChange,
      }}
    >
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <CssBaseline />
      {mobile ? (
        <Drawer
          variant="temporary"
          open={open}
          onClose={() => setOpen(false)}
          sx={{ "& .MuiDrawer-paper": { width: expandedWidth } }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width,
            flexShrink: 0,
            transition: theme.transitions.create("width"),
            "& .MuiDrawer-paper": {
              width,
              boxSizing: "border-box",
              border: "none",
              transition: theme.transitions.create("width"),
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          <Toolbar sx={{ gap: 1.5 }}>
            {mobile && (
              <IconButton onClick={() => setOpen(true)}>
                <MenuIcon />
              </IconButton>
            )}

            <Box
              sx={{
                bgcolor: "action.hover",
                borderRadius: 2.5,
                display: "flex",
                alignItems: "center",
                px: 1.5,
                flex: 1,
                maxWidth: 400,
              }}
            >
              <Search color="action" />
              <InputBase
                placeholder="Buscar no Cloud Manager"
                sx={{ ml: 1, flex: 1 }}
              />
            </Box>

            {/* Select dinâmico de Organizações */}
            <Select
              size="small"
              value={activeOrgId || data?.user.organizationId || ""}
              onChange={(e) => handleOrgChange(String(e.target.value))}
              displayEmpty
              sx={{ display: { xs: "none", md: "flex" }, minWidth: 180 }}
            >
              {organizations.length > 0 ? (
                organizations.map((org) => (
                  <MenuItem key={org.id} value={org.id}>
                    {org.name}
                  </MenuItem>
                ))
              ) : (
                <MenuItem value={data?.user.organizationId || ""}>
                  {data?.user.organizationName || "Empresa"}
                </MenuItem>
              )}
            </Select>

            {sectors.length > 0 && (
              <Select
                size="small"
                value={activeSectorId}
                onChange={(e) => handleSectorChange(String(e.target.value))}
                sx={{ display: { xs: "none", sm: "flex" }, minWidth: 160 }}
              >
                {sectors.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
            )}

            <Tooltip title="Notificações">
              <IconButton>
                <NotificationsNone />
              </IconButton>
            </Tooltip>

            <Tooltip title="Alternar tema">
              <IconButton
                aria-label="Alternar tema"
                onClick={() =>
                  setMode(effectiveMode === "dark" ? "light" : "dark")
                }
              >
                {effectiveMode === "dark" ? <LightMode /> : <DarkMode />}
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          sx={{ p: { xs: 2, md: 3.5 }, maxWidth: 1600, mx: "auto" }}
        >
          {children}
        </Box>
      </Box>
    </Box>
    </ActiveTenantContext.Provider>
  );
}
