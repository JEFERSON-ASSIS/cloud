# i7AI Cloud Manager — Correções realizadas e pendências

Atualizado em: 7 de agosto de 2026  
Repositório: `C:\xampp\htdocs\producao\i7ai-cloud-manager`  
Escopo: serviço SaaS, exceto pagamentos

## 1. Objetivo

Este documento consolida as correções implementadas localmente, as validações executadas, o que ainda precisa ser corrigido e os passos necessários para publicar as mudanças com segurança.

> Estado atual: as mudanças estão no diretório de trabalho local. Ainda não houve commit, push, migration no banco de produção, reinício dos serviços ou deploy.

## 2. Resumo executivo

Foram corrigidos três grupos principais nesta entrega contínua:

1. Contexto multitenant de empresa, secretaria e usuários (entrega anterior).
2. Problemas críticos de segurança, quota, autenticação e restauração de backups (entrega anterior).
3. Isolamento de documentos/pastas, empresa ativa do superadmin, SSRF, scheduler/retenção e compensação de fila (esta rodada).

Validações da rodada atual:

- typecheck de `@i7ai/web`, `@i7ai/worker` e `@i7ai/backup-core` aprovado;
- suite de testes aprovada (inclui novos testes de retenção e outbound seguro).

## 3. Correções realizadas

### 3.1–3.8 Entrega anterior

Mantidas conforme seção anterior do documento:

- contexto único de empresa/secretaria;
- cadastro/edição de usuários com vínculos;
- remoção da credencial administrativa fixa;
- proteção das credenciais de backup;
- separação entre quota contratada e limite por arquivo;
- restauração remota real por SSH;
- revogação imediata de acesso;
- dependências sem vulnerabilidades no `npm audit`.

### 3.9 Isolamento de documentos e pastas por secretaria

Implementado:

- `folders/[id]` exige papel `EDITOR` na secretaria de origem e, em move cross-sector, também no destino;
- exclusão permanente de documento valida secretaria com `EDITOR`;
- mutações de documento exigem `EDITOR` (bloqueia `VIEWER_DOWNLOAD`);
- move de documento sincroniza `folderId`, `sectorId` e `storageSpaceId`;
- move de pasta entre secretarias atualiza a árvore inteira (pastas + documentos);
- download exige `VIEWER_DOWNLOAD`; preview aceita `VIEWER_ONLY`;
- listagem de arquivos distingue `isReadOnly` e `canDownload`.

Arquivos principais:

- `apps/web/src/app/api/folders/[id]/route.ts`
- `apps/web/src/app/api/documents/[id]/route.ts`
- `apps/web/src/app/api/documents/[id]/content/route.ts`
- `apps/web/src/app/api/files/route.ts`
- `apps/web/src/server/documents.ts`
- `apps/web/src/app/(protected)/arquivos/page.tsx`

### 3.10 Empresa ativa centralizada (superadmin)

Implementado:

- helper `requireTenantOrganization` resolve empresa por header `x-organization-id`, query, body ou sessão;
- `SUPER_ADMIN` pode operar na empresa selecionada no UI; demais papéis ficam na org da sessão;
- rotas de backups, agendamentos, servidores, integrações, settings, logs, storage spaces, notifications e documents by id migradas;
- client `tenantFetch` anexa header/query automaticamente a partir do `localStorage` da empresa ativa.

Arquivos principais:

- `apps/web/src/server/tenant.ts`
- `apps/web/src/lib/tenant-fetch.ts`
- `apps/web/src/lib/tenant-constants.ts`
- páginas protegidas de backups, agendamentos, servidores, integrações, logs e configurações

### 3.11 Proteção SSRF / outbound

Implementado:

- validação de host SSH (bloqueia loopback, link-local e metadados; permite RFC1918 para backups internos);
- webhooks exigem HTTPS, bloqueiam redes privadas, resolvem DNS e usam fetch sem redirect com timeout;
- validação na criação/edição de servidores, teste SSH, persistência de notificações e envio de webhooks.

Arquivos principais:

- `packages/security/src/safe-outbound.ts`
- `apps/web/src/app/api/servers/test/route.ts`
- `apps/web/src/app/api/servers/route.ts`
- `apps/web/src/app/api/servers/[id]/route.ts`
- `apps/web/src/app/api/notifications/route.ts`
- `packages/backup-core/src/notifications.ts`

### 3.12 Agendamentos, retenção e fila Redis

Implementado:

- `syncScheduler` recria cron quando frequência, horário, timezone ou fontes mudam;
- PATCH de agendamento passa a aceitar `frequency`;
- retenção GFS: daily + âncoras weekly/monthly;
- falha ao apagar arquivo remoto adia a exclusão local;
- falha ao enfileirar no Redis marca o run como `FAILED` (scheduler, backup manual e restore);
- jobs BullMQ com `attempts: 3` e backoff exponencial.

Arquivos principais:

- `apps/worker/src/index.ts`
- `apps/web/src/app/api/schedules/[id]/route.ts`
- `packages/backup-core/src/retention.ts`
- `packages/backup-core/src/queue.ts`
- `apps/web/src/app/api/backup-sources/[id]/route.ts`
- `apps/web/src/app/api/backups/restore/route.ts`

## 4. Pendências ainda não corrigidas

### 4.1 Prioridade alta

#### Exclusão remota de organizações e secretarias

O sistema remove dados do Drive antes de concluir o soft delete local. Deve ser adotado um fluxo assíncrono e reconciliável, com estado `DELETING`, auditoria, retentativas e política de recuperação.

#### Infraestrutura de produção

- remover segredos literais do `docker-compose.swarm.yml` e usar Docker Secrets;
- rotacionar segredos caso os valores versionados já tenham sido utilizados;
- ativar persistência AOF e volume dedicado para Redis;
- implementar desligamento gracioso do worker;
- reconciliador periódico de runs `PENDING` órfãos (além da compensação síncrona já feita).

### 4.2 Prioridade média

- retirar criação de pastas do `GET /api/files`;
- validar secretaria antes de gerar breadcrumbs;
- substituir métricas fixas de secretaria por uso e contagens reais;
- proteger todo o grupo de páginas privadas no middleware/layout;
- separar healthcheck de liveness e readiness, incluindo Redis e worker;
- adicionar quality gate no CI antes de publicar imagens;
- publicar imagens por SHA/digest, não somente tags mutáveis;
- corrigir os erros preexistentes do lint completo;
- atualizar README e documentação de backups;
- ampliar testes de worker, scheduler, restore, Drive e isolamento das APIs;
- alinhar página de auditoria ao `useActiveTenant` global.

## 5. Checklist para publicação

### 5.1 Antes do deploy

1. Revisar o diff e confirmar que os arquivos locais anteriores pertencem à mesma entrega.
2. Fazer backup do PostgreSQL.
3. Confirmar `AUTH_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL` e credenciais externas no ambiente.
4. Confirmar que nenhum segredo do manifesto Swarm será reutilizado em produção.
5. Preparar um servidor e banco descartáveis para o smoke test de restauração.

### 5.2 Aplicação da migration

```powershell
npm run db:migrate
```

Após aplicar, confirmar:

```sql
SELECT id, name, storage_limit, max_upload_file_size
FROM organizations
ORDER BY name;
```

Validar especialmente empresas cuja quota tenha sido anteriormente alterada pela tela de limite por arquivo.

### 5.3 Build e reinício

```powershell
npm run build
```

Reiniciar obrigatoriamente:

- serviço web;
- worker BullMQ;
- scheduler incorporado ao worker.

### 5.4 Smoke tests obrigatórios

#### Usuários e multitenancy

- selecionar empresa A, navegar e recarregar;
- confirmar que a empresa A continua selecionada;
- cadastrar usuário na empresa A e em secretarias específicas;
- vincular o mesmo usuário à empresa B;
- remover o vínculo da empresa A e confirmar acesso preservado à B;
- bloquear o usuário e confirmar revogação imediata.

#### Superadmin + empresa ativa

- como `SUPER_ADMIN`, selecionar empresa B no cabeçalho;
- criar servidor/fonte/agendamento e abrir detalhe — devem gravar/ler na empresa B;
- abrir Arquivos da empresa B e mutar documento/pasta.

#### Isolamento por secretaria

- usuário `VIEWER_DOWNLOAD` não deve renomear/mover/excluir;
- usuário `VIEWER_ONLY` pode pré-visualizar, mas não baixar;
- move de pasta entre secretarias deve refletir `sectorId` nos filhos.

#### Quotas / segredos / restauração

- manter checklist da entrega anterior (quota, segredos omitidos, restore real).

#### SSRF

- webhook `http://` ou URL de IP privado deve ser rejeitado;
- teste SSH para `127.0.0.1` / `169.254.169.254` deve falhar;
- SSH para host privado RFC1918 legítimo do cliente deve continuar permitido.

#### Agendamentos

- editar horário/frequência/fontes e confirmar que o próximo sync recria o cron;
- confirmar retenção weekly/monthly preservando âncoras.

## 6. Comandos de validação executados

```powershell
npm test
npm run typecheck --workspace=@i7ai/web
npm run typecheck --workspace=@i7ai/worker
npm run typecheck --workspace=@i7ai/backup-core
```

Resultados da rodada atual:

- testes aprovados (incluindo retenção e outbound seguro);
- typecheck dos pacotes alterados aprovado.

## 7. Estado de Git e deploy

No momento da atualização deste documento:

- alterações ainda não commitadas;
- nada enviado ao repositório remoto;
- migration ainda não aplicada ao banco de produção;
- nenhum container ou serviço reiniciado;
- nenhuma restauração real executada.

## 8. Ordem recomendada para a próxima etapa

1. Revisar e versionar a entrega atual (commit).
2. Aplicar a migration em homologação.
3. Executar todos os smoke tests deste documento.
4. Corrigir exclusão assíncrona de organizações/secretarias.
5. Endurecer infraestrutura Redis/Secrets e graceful shutdown.
6. Publicar em produção com backup, migration e rollback preparados.
