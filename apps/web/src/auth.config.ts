import type { NextAuthConfig } from "next-auth";
export const authConfig = {
  pages: { signIn: "/login", error: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const protectedRoute =
        request.nextUrl.pathname.startsWith("/dashboard") ||
        request.nextUrl.pathname.startsWith("/usuarios") ||
        request.nextUrl.pathname.startsWith("/empresas");
      return protectedRoute ? Boolean(auth?.user) : true;
    },
  },
} satisfies NextAuthConfig;
