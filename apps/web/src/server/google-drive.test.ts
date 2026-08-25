import { beforeAll, describe, expect, it } from "vitest";

describe("URL de autorização do Google Drive", () => {
  beforeAll(() => {
    process.env.GOOGLE_CLIENT_ID = "client-de-teste";
    process.env.GOOGLE_CLIENT_SECRET = "segredo-de-teste";
    process.env.GOOGLE_REDIRECT_URI = "https://exemplo.test/callback";
  });

  it("pede apenas escopos não restritos", async () => {
    const { googleAuthorizationUrl } = await import("./google-drive");
    const scope = new URL(googleAuthorizationUrl("estado")).searchParams.get(
      "scope",
    );
    // auth/drive é escopo restrito: exige verificação com auditoria externa e
    // faz o consentimento exibir "O Google não verificou este app".
    expect(scope?.split(" ")).toEqual([
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/userinfo.email",
    ]);
  });

  it("envia o parâmetro de estado contra falsificação de identidade", async () => {
    const { googleAuthorizationUrl } = await import("./google-drive");
    const url = new URL(googleAuthorizationUrl("estado-assinado"));
    expect(url.searchParams.get("state")).toBe("estado-assinado");
  });
});
