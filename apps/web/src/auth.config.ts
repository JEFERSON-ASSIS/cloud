import type { NextAuthConfig } from "next-auth";

/** Rotas públicas (página ou API). Demais exigem sessão. */
function isPublicPath(pathname: string): boolean {
  if (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/recuperar-senha" ||
    pathname.startsWith("/recuperar-senha/") ||
    pathname === "/redefinir-senha" ||
    pathname.startsWith("/redefinir-senha/")
  ) {
    return true;
  }
  if (pathname === "/api/health" || pathname.startsWith("/api/health/")) {
    return true;
  }
  if (pathname.startsWith("/api/password/")) {
    return true;
  }
  return false;
}

export const authConfig = {
  pages: { signIn: "/login", error: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      if (isPublicPath(request.nextUrl.pathname)) return true;
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
