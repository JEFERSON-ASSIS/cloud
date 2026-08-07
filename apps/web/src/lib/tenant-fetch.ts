"use client";

import { ACTIVE_ORG_HEADER } from "@/lib/tenant-constants";

const STORAGE_KEY = "active-org-id";

export function getClientActiveOrganizationId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export async function tenantFetch(
  input: string | URL,
  init: RequestInit = {},
  organizationId?: string | null,
): Promise<Response> {
  const activeOrgId = organizationId ?? getClientActiveOrganizationId();
  const headers = new Headers(init.headers);
  if (activeOrgId && !headers.has(ACTIVE_ORG_HEADER)) {
    headers.set(ACTIVE_ORG_HEADER, activeOrgId);
  }

  let url = typeof input === "string" ? input : input.toString();
  if (activeOrgId && (init.method ?? "GET").toUpperCase() === "GET") {
    const parsed = new URL(url, window.location.origin);
    if (!parsed.searchParams.has("organizationId")) {
      parsed.searchParams.set("organizationId", activeOrgId);
      url = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  }

  return fetch(url, { ...init, headers });
}
