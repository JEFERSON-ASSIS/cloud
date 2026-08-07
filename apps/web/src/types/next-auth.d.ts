import type { DefaultSession } from "next-auth";
import type { Permission, RoleName } from "@i7ai/types";
declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      organizationId: string | null;
      organizationName: string | null;
      role: RoleName | null;
      permissions: Permission[];
      menuKeys: string[];
    };
  }
  interface User {
    organizationId: string | null;
    organizationName: string | null;
    role: RoleName | null;
    permissions: Permission[];
    menuKeys: string[];
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    organizationId: string | null;
    organizationName: string | null;
    role: RoleName | null;
    permissions: Permission[];
    menuKeys: string[];
  }
}
