import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

/**
 * Protege páginas. APIs ficam de fora do matcher:
 * - já autenticam via requireTenant
 * - multipart (upload) quebra se o middleware tocar no body ("Failed to parse body as FormData")
 */
export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico).*)",
  ],
};
