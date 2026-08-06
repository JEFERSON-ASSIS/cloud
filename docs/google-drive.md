# Google Drive

## Configuração

1. Crie um projeto no Google Cloud Console.
2. Habilite a Google Drive API.
3. Configure a tela de consentimento OAuth.
4. Crie credenciais OAuth 2.0 do tipo Aplicativo da Web.
5. Cadastre exatamente o valor de `GOOGLE_REDIRECT_URI` como URI autorizada.
6. Preencha `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REDIRECT_URI` no `.env` e reinicie o serviço web.

Para a instalação local atual:

```env
GOOGLE_REDIRECT_URI=http://localhost:3002/api/integrations/google-drive/callback
```

## Segurança

O parâmetro `state` é assinado por HMAC, expira em dez minutos e contém os IDs da sessão e da empresa. O callback rejeita divergências. Access e refresh tokens são armazenados com AES-256-GCM; nunca são devolvidos pela API nem escritos em logs. A renovação ocorre automaticamente antes da expiração.

Todas as consultas locais incluem `organization_id`. Os IDs remotos do Drive são persistidos e usados como identidade; nomes de pastas não são usados para localizar arquivos.

## Estrutura remota

Ao primeiro uso, o sistema cria:

```text
i7AI Cloud/
  Documents/
    nome-da-empresa/
```

Documentos são enviados diretamente ao Google Drive. O PostgreSQL mantém apenas metadados, tamanho, tipo MIME e checksum SHA-256.

## Operação

Na tela Integrações, use Conectar Google Drive. Depois do consentimento, teste a conexão e confira a quota. A desconexão remove os tokens locais; documentos permanecem no Drive, mas ficam indisponíveis até uma nova conexão.
