import { prisma } from "@i7ai/database";
import { decryptSecret, encryptSecret } from "@/server/encryption";
import { GoogleDriveStorageProvider } from "@i7ai/storage";

export async function getGoogleDriveProvider(targetOrgId?: string) {
  const whereClause: any = {
    provider: "GOOGLE_DRIVE",
    status: "CONNECTED",
    deletedAt: null,
  };
  if (targetOrgId) {
    whereClause.organizationId = targetOrgId;
  }

  let connection = await prisma.storageConnection.findFirst({
    where: whereClause,
    include: { googleDrive: true },
  });

  if (!connection?.googleDrive && targetOrgId) {
    connection = await prisma.storageConnection.findFirst({
      where: { provider: "GOOGLE_DRIVE", status: "CONNECTED", deletedAt: null },
      include: { googleDrive: true },
    });
  }

  if (!connection?.googleDrive) {
    return null;
  }

  let accessToken = decryptSecret(connection.googleDrive.encryptedAccessToken);

  if (
    connection.googleDrive.expiresAt &&
    connection.googleDrive.expiresAt.getTime() < Date.now() + 60_000
  ) {
    if (connection.googleDrive.encryptedRefreshToken) {
      try {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId || "",
            client_secret: clientSecret || "",
            refresh_token: decryptSecret(connection.googleDrive.encryptedRefreshToken),
            grant_type: "refresh_token",
          }),
        });

        if (response.ok) {
          const refreshed = await response.json();
          accessToken = refreshed.access_token;
          await prisma.googleDriveConnection.update({
            where: { id: connection.googleDrive.id },
            data: {
              encryptedAccessToken: encryptSecret(accessToken),
              expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
            },
          });
        }
      } catch (errRefresh) {
        console.warn("Falha ao renovar token do Google Drive:", errRefresh);
      }
    }
  }

  return {
    drive: new GoogleDriveStorageProvider(accessToken),
    connection,
  };
}
