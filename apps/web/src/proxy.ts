import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

/**
 * Protege páginas. Fora do matcher:
 * - /api/* (requireTenant + evita quebrar FormData de upload)
 * - estáticos (_next, favicon, logos) — senão a tela de login perde o ícone
 */
export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon\\.ico|favicon\\.png|apple-touch-icon\\.png|i7ai-logo\\.png|i7ai-logo-white\\.jpg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
