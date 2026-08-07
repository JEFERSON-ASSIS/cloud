import { prisma } from "@i7ai/database";
import { GoogleDriveStorageProvider } from "@i7ai/storage";
import { decryptSecret, encryptSecret } from "./encryption";

function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri)
    throw new Error(
      "Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI.",
    );
  return { clientId, clientSecret, redirectUri };
}

export function googleAuthorizationUrl(state: string) {
  const { clientId, redirectUri } = googleConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope:
      "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(code: string) {
  const { clientId, clientSecret, redirectUri } = googleConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw new Error("O Google recusou a autorização.");
  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
}

async function refreshToken(refreshToken: string) {
  const { clientId, clientSecret } = googleConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok)
    throw new Error("Não foi possível renovar o acesso ao Google Drive.");
  return (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
}

export async function driveForOrganization(organizationId: string) {
  const connection = await prisma.storageConnection.findFirst({
    where: {
      organizationId,
      provider: "GOOGLE_DRIVE",
      status: "CONNECTED",
      deletedAt: null,
    },
    include: { googleDrive: true },
  });
  if (!connection?.googleDrive)
    throw new Error("Conecte o Google Drive antes de continuar.");
  let accessToken = decryptSecret(connection.googleDrive.encryptedAccessToken);
  if (
    connection.googleDrive.expiresAt &&
    connection.googleDrive.expiresAt.getTime() < Date.now() + 60_000
  ) {
    if (!connection.googleDrive.encryptedRefreshToken)
      throw new Error("Reconecte o Google Drive.");
    const refreshed = await refreshToken(
      decryptSecret(connection.googleDrive.encryptedRefreshToken),
    );
    accessToken = refreshed.access_token;
    await prisma.googleDriveConnection.update({
      where: { id: connection.googleDrive.id },
      data: {
        encryptedAccessToken: encryptSecret(accessToken),
        expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      },
    });
  }
  return { connection, drive: new GoogleDriveStorageProvider(accessToken) };
}

export async function ensureDriveRoot(
  organizationId: string,
  organizationName: string,
) {
  const result = await driveForOrganization(organizationId);
  if (result.connection.googleDrive!.rootFolderId)
    return {
      ...result,
      rootFolderId: result.connection.googleDrive!.rootFolderId!,
    };
  const root = await result.drive.createFolder("i7AI Cloud");
  const documents = await result.drive.createFolder("Documents", root);
  const organization = await result.drive.createFolder(
    organizationName,
    documents,
  );
  await prisma.googleDriveConnection.update({
    where: { id: result.connection.googleDrive!.id },
    data: { rootFolderId: organization },
  });
  return { ...result, rootFolderId: organization };
}

export async function ensureSectorDriveFolder(
  organizationId: string,
  organizationName: string,
  sectorId: string,
  sectorName: string,
) {
  const { connection, drive, rootFolderId } = await ensureDriveRoot(
    organizationId,
    organizationName,
  );

  const storageSpace = await prisma.storageSpace.findFirst({
    where: { organizationId, sectorId, deletedAt: null },
  });

  if (storageSpace?.rootFolderId) {
    return { connection, drive, sectorFolderId: storageSpace.rootFolderId };
  }

  const sectorFolderId = await drive.createFolder(sectorName, rootFolderId);

  if (storageSpace) {
    await prisma.storageSpace.update({
      where: { id: storageSpace.id },
      data: { rootFolderId: sectorFolderId },
    });
  } else {
    await prisma.storageSpace.create({
      data: {
        organizationId,
        sectorId,
        name: sectorName,
        rootFolderId: sectorFolderId,
      },
    });
  }

  return { connection, drive, sectorFolderId };
}
