"use client";

import { useState, useEffect, type PropsWithChildren } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useColorScheme } from "@mui/material/styles";
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  InputBase,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Select,
  Toolbar,
  Tooltip,
  Typography,
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

const expandedWidth = 264;
const collapsedWidth = 76;

const items = [
  ["Dashboard", "/dashboard", <DashboardOutlined key="d" />],
  ["Secretarias", "/secretarias", <Apartment key="sec" />],
  ["Arquivos", "/arquivos", <FolderOutlined key="a" />],
  ["Pastas", "/pastas", <FolderCopyOutlined key="p" />],
  ["Backups", "/backups", <BackupOutlined key="b" />],
  ["Agendamentos", "/agendamentos", <ScheduleOutlined key="ag" />],
  ["Servidores", "/servidores", <DnsOutlined key="s" />],
  ["Integrações", "/integracoes", <HubOutlined key="i" />],
  ["Usuários", "/usuarios", <PeopleOutlined key="u" />],
  ["Empresas", "/empresas", <BusinessOutlined key="e" />],
  ["Auditoria", "/auditoria", <FactCheckOutlined key="au" />],
  ["Logs", "/logs", <ReceiptLongOutlined key="l" />],
  ["Configurações", "/configuracoes", <SettingsOutlined key="c" />],
] as const;

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
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const [sectors, setSectors] = useState<{ id: string; name: string }[]>([]);
  const [activeSectorId, setActiveSectorId] = useState<string>("");

  useEffect(() => {
    if (data?.user?.organizationId) {
      fetch("/api/sectors")
        .then((res) => res.json())
        .then((list) => {
          if (Array.isArray(list)) {
            setSectors(list);
            const saved = localStorage.getItem("active-sector-id");
            const found = list.find((s) => s.id === saved) || list[0];
            if (found) {
              setActiveSectorId(found.id);
              localStorage.setItem("active-sector-id", found.id);
            }
          }
        })
        .catch(() => {});
    }
  }, [data?.user?.organizationId]);

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

  const drawer = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#101827",
        color: "#D8E1EF",
      }}
    >
      <Toolbar sx={{ px: 2.25, gap: 1.5, flexShrink: 0 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2.5,
            bgcolor: "primary.main",
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
            color: "white",
          }}
        >
          i7
        </Box>
        {!collapsed && (
          <Typography color="white" sx={{ fontWeight: 750, fontSize: 16 }}>
            Cloud Manager
          </Typography>
        )}
      </Toolbar>

      <Divider sx={{ borderColor: "rgba(255,255,255,.08)" }} />

      <List sx={{ p: 1.25, flex: 1, overflowY: "auto" }}>
        {items.map(([label, href, icon]) => (
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

      {/* Seção Inferior com o Botão Sair */}
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
                "&:hover": { color: "white" },
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
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Drawer
        variant={mobile ? "temporary" : "permanent"}
        open={mobile ? open : true}
        onClose={() => setOpen(false)}
        sx={{
          width: mobile ? expandedWidth : width,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: mobile ? expandedWidth : width,
            border: 0,
            transition: "width .2s",
          },
        }}
      >
        {drawer}
      </Drawer>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Toolbar sx={{ gap: 1.5 }}>
            {mobile && (
              <IconButton onClick={() => setOpen(true)} aria-label="Abrir menu">
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

            <Select
              size="small"
              value={data?.user.organizationId ?? ""}
              displayEmpty
              sx={{ display: { xs: "none", md: "flex" }, minWidth: 160 }}
            >
              <MenuItem value={data?.user.organizationId ?? ""}>
                {data?.user.organizationName ?? "Empresa"}
              </MenuItem>
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

            <IconButton onClick={(event) => setAnchor(event.currentTarget)}>
              <Avatar sx={{ width: 34, height: 34 }}>
                {data?.user.name?.[0] ?? "U"}
              </Avatar>
            </IconButton>

            <Menu
              anchorEl={anchor}
              open={Boolean(anchor)}
              onClose={() => setAnchor(null)}
            >
              <MenuItem disabled>{data?.user.email}</MenuItem>
              <MenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                <Logout fontSize="small" sx={{ mr: 1 }} />
                Sair da conta
              </MenuItem>
            </Menu>
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
  );
}
