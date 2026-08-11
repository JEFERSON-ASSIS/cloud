# Uploads grandes e resumíveis

O gerenciador de arquivos envia documentos ao Google Drive em blocos de 8 MB. O arquivo permanece único no armazenamento; os blocos existem apenas durante a transmissão.

## Fluxo

1. `POST /api/documents/uploads` valida usuário, empresa, secretaria, limite individual e quota, inicia uma sessão resumível no Google Drive e reserva a quota no PostgreSQL.
2. `PUT /api/documents/uploads/{id}/chunk` recebe no máximo 8 MB, valida `Content-Length` e `Content-Range` e repassa o bloco ao Google.
3. `GET /api/documents/uploads/{id}` consulta o deslocamento confirmado e permite retomar um envio interrompido.
4. `POST /api/documents/uploads/{id}/complete` confirma o tamanho remoto, calcula SHA-256 lendo o arquivo como stream e só então cria o documento disponível.
5. `DELETE /api/documents/uploads/{id}` cancela uma sessão ainda não concluída.

Sessões expiram após 24 horas. A URI resumível do Google é criptografada no banco. Sessões ativas reservam quota para impedir que uploads simultâneos ultrapassem o espaço contratado.

## Banco de dados

Antes de publicar a imagem Web, aplique:

```bash
npm run db:migrate
```

A migration `20260811100000_resumable_document_uploads` cria `document_upload_sessions` e o enum `DocumentUploadStatus`.

## Observabilidade

Os eventos são gravados em JSON com `scope=document-upload`:

- `started`;
- `chunk-confirmed`;
- `completed`;
- `start-failed`;
- `chunk-failed`;
- `finalize-failed`;
- `legacy-upload-failed`.

Na VPS:

```bash
docker service logs i7ai-cloud_i7ai-cloud-web --since 30m --timestamps 2>&1 | grep 'document-upload'
```

## Validação de publicação

Teste progressivamente arquivos de 10 MB, 100 MB, 500 MB e, se o limite da empresa permitir, 1 GB. Durante o teste, acompanhe:

```bash
docker stats
docker service ps i7ai-cloud_i7ai-cloud-web --no-trunc
```

Confirme que o arquivo abre no aplicativo original, que tamanho e SHA-256 foram gravados, que não existe tarefa com saída 137 e que uma interrupção de rede retoma do último bloco confirmado.

## Reversão

Reverter somente a imagem Web não remove a tabela nova e é seguro. A tabela deve permanecer durante a reversão para preservar o histórico e permitir limpeza posterior das sessões incompletas. Não reverta a migration de forma destrutiva em produção.
