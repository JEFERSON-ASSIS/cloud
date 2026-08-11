import { requireTenantOrganization } from "@/server/tenant";
import { createOAuthState } from "@/server/oauth-state";
import { googleAuthorizationUrl } from "@/server/google-drive";
import { userFacingStorageError } from "@/server/storage-error";

export async function GET(request: Request) {
  let actorRole: string | null | undefined;
  try {
    const { tenant, organizationId } = await requireTenantOrganization(
      "integration.manage",
      request,
    );
    actorRole = tenant.role;
    const state = createOAuthState({
      organizationId,
      userId: tenant.userId,
      expiresAt: Date.now() + 10 * 60_000,
    });
    return Response.redirect(googleAuthorizationUrl(state));
  } catch (error) {
    const message = encodeURIComponent(
      userFacingStorageError(
        error,
        actorRole,
        "Não foi possível conectar o armazenamento em nuvem.",
      ),
    );
    return Response.redirect(
      `${process.env.APP_URL}/integracoes?error=${message}`,
    );
  }
}
