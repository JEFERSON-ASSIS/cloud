import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";
import { AppShell } from "@/components/AppShell/AppShell";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return (
    <SessionProvider session={session}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
