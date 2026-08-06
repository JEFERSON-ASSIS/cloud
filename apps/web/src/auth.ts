import argon2 from "argon2";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@i7ai/database";
import type { Permission, RoleName } from "@i7ai/types";
import { z } from "zod";
import { authConfig } from "./auth.config";

const credentialsSchema = z.object({
  email: z.email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8).max(200),
});
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET!,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60, updateAge: 30 * 60 },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          include: {
            organizations: {
              where: { organization: { status: "ACTIVE", deletedAt: null } },
              orderBy: { isDefault: "desc" },
              include: {
                organization: true,
                role: {
                  include: { permissions: { include: { permission: true } } },
                },
              },
            },
          },
        });
        if (
          !user ||
          user.status !== "ACTIVE" ||
          user.deletedAt ||
          !(await argon2.verify(user.passwordHash, parsed.data.password))
        )
          return null;
        const membership = user.organizations[0];
        if (!membership) return null;
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        await prisma.auditLog.create({
          data: {
            organizationId: membership.organizationId,
            userId: user.id,
            action: "LOGIN",
            resourceType: "Session",
          },
        });
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          organizationId: membership.organizationId,
          organizationName: membership.organization.name,
          role: membership.role.name as RoleName,
          permissions: membership.role.permissions.map(
            (item) => item.permission.key as Permission,
          ),
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id!;
        token.organizationId = user.organizationId;
        token.organizationName = user.organizationName;
        token.role = user.role;
        token.permissions = user.permissions;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.organizationId = token.organizationId as string | null;
      session.user.organizationName = token.organizationName as string | null;
      session.user.role = token.role as RoleName | null;
      session.user.permissions = token.permissions as Permission[];
      return session;
    },
  },
  events: {
    async signOut(message) {
      if (!("token" in message) || !message.token) return;
      const userId =
        typeof message.token.userId === "string" ? message.token.userId : null;
      const organizationId =
        typeof message.token.organizationId === "string"
          ? message.token.organizationId
          : null;
      await prisma.auditLog.create({
        data: {
          userId,
          organizationId,
          action: "LOGOUT",
          resourceType: "Session",
        },
      });
    },
  },
});
