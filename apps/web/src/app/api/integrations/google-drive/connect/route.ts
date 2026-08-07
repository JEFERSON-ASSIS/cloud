import { requireTenantOrganization } from "@/server/tenant";
import { createOAuthState } from "@/server/oauth-state";
import { googleAuthorizationUrl } from "@/server/google-drive";

export async function GET(request: Request) {
  try {
    const { tenant, organizationId } = await requireTenantOrganization(
      "integration.manage",
      request,
    );
    const state = createOAuthState({
      organizationId,
      userId: tenant.userId,
      expiresAt: Date.now() + 10 * 60_000,
    });
    return Response.redirect(googleAuthorizationUrl(state));
  } catch (error) {
    const message = encodeURIComponent(
      error instanceof Error ? error.message : "Erro de conexão.",
    );
    return Response.redirect(
      `${process.env.APP_URL}/integracoes?error=${message}`,
    );
  }
}
