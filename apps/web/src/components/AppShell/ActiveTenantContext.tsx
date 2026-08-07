"use client";

import { createContext, useContext } from "react";

export type TenantOption = { id: string; name: string; organizationId?: string };

type ActiveTenantContextValue = {
  organizations: TenantOption[];
  sectors: TenantOption[];
  activeOrganizationId: string;
  activeSectorId: string;
  setActiveOrganizationId: (id: string) => void;
  setActiveSectorId: (id: string) => void;
};

export const ActiveTenantContext = createContext<ActiveTenantContextValue | null>(null);

export function useActiveTenant() {
  const context = useContext(ActiveTenantContext);
  if (!context) throw new Error("useActiveTenant deve ser usado dentro do AppShell.");
  return context;
}
