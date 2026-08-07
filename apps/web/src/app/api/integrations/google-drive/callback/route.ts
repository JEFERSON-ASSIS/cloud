import { auth } from "@/auth";
import { prisma } from "@i7ai/database";
import { encryptSecret } from "@/server/encryption";
import { exchangeGoogleCode } from "@/server/google-drive";
import { verifyOAuthState } from "@/server/oauth-state";
import { writeAudit } from "@/server/audit";

export async function GET(request: Request) {
  const redirect = (query: string) =>
    Response.redirect(`${process.env.APP_URL}/integracoes?${query}`);
  try {
    const session = await auth();
    const url = new URL(request.url);
    if (url.searchParams.get("error"))
      return redirect("error=Autoriza%C3%A7%C3%A3o%20cancelada.");
    const code = url.searchParams.get("code");
    const stateValue = url.searchParams.get("state");
    if (!code || !stateValue || !session?.user?.id)
      throw new Error("Resposta OAuth inválida.");
    const state = verifyOAuthState(stateValue);
    if (state.userId !== session.user.id) {
      throw new Error("A autorização não pertence à sessão atual.");
    }
    // SUPER_ADMIN pode conectar para a empresa ativa (≠ organizationId do JWT).
    if (
      session.user.role !== "SUPER_ADMIN" &&
      state.organizationId !== session.user.organizationId
    ) {
      throw new Error("A autorização não pertence à empresa da sessão.");
    }
    if (session.user.role === "SUPER_ADMIN") {
      const membership = await prisma.organization.findFirst({
        where: { id: state.organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!membership) throw new Error("Empresa da autorização não encontrada.");
    }
    const tokens = await exchangeGoogleCode(code);
    const profileResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    const profile = profileResponse.ok
      ? ((await profileResponse.json()) as { email?: string })
      : {};
    const existing = await prisma.storageConnection.findFirst({
      where: { organizationId: state.organizationId, provider: "GOOGLE_DRIVE" },
      include: { googleDrive: true },
    });
    const connection = existing
      ? await prisma.storageConnection.update({
          where: { id: existing.id },
          data: { status: "CONNECTED", deletedAt: null, name: "Armazenamento em nuvem" },
        })
      : await prisma.storageConnection.create({
          data: {
            organizationId: state.organizationId,
            provider: "GOOGLE_DRIVE",
            status: "CONNECTED",
            name: "Armazenamento em nuvem",
          },
        });
    await prisma.googleDriveConnection.upsert({
      where: { storageConnectionId: connection.id },
      create: {
        storageConnectionId: connection.id,
        encryptedAccessToken: encryptSecret(tokens.access_token),
        encryptedRefreshToken: tokens.refresh_token
          ? encryptSecret(tokens.refresh_token)
          : null,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        accountEmail: profile.email ?? null,
      },
      update: {
        encryptedAccessToken: encryptSecret(tokens.access_token),
        ...(tokens.refresh_token
          ? { encryptedRefreshToken: encryptSecret(tokens.refresh_token) }
          : {}),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        accountEmail: profile.email ?? null,
      },
    });
    await writeAudit({
      organizationId: state.organizationId,
      userId: state.userId,
      action: "STORAGE_CONNECTED",
      resourceType: "StorageConnection",
      resourceId: connection.id,
    });
    return redirect("connected=1");
  } catch (error) {
    return redirect(
      `error=${encodeURIComponent(error instanceof Error ? error.message : "Erro de conexão.")}`,
    );
  }
}
