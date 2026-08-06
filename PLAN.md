# Plano de implementação — i7AI Cloud Manager

## Objetivo

Construir uma plataforma SaaS multiempresa para documentos e backups, com isolamento por organização, execução assíncrona e provedores de armazenamento substituíveis. A implementação será entregue em fases verificáveis; nenhuma fase posterior será iniciada automaticamente.

## Arquitetura

- Monorepo com npm workspaces e Turborepo.
- `apps/web`: Next.js App Router, Route Handlers, Auth.js, Material UI e TanStack Query.
- `apps/worker`: processo Node.js isolado para BullMQ e operações demoradas (iniciado na Fase 3).
- `packages/database`: Prisma, cliente PostgreSQL, migrations e seed.
- `packages/config`: validação centralizada de ambiente e configuração TypeScript compartilhada.
- `packages/types`: contratos compartilhados e permissões.
- `packages/security`: autorização multiempresa e utilitários de segurança.
- `packages/backup-core` e `packages/storage`: contratos preparados agora, implementações nas fases correspondentes.
- Docker Compose para desenvolvimento e produção, com PostgreSQL/Redis em rede interna.

## Dependências e compatibilidade

- Node.js 24 LTS compatível com o ambiente atual.
- Next.js 16, React 19 e TypeScript em modo `strict`.
- Material UI 7, MUI X Data Grid, React Hook Form, Zod, TanStack Query, Recharts e date-fns.
- Auth.js v5 (`next-auth`) com credenciais e sessão JWT segura.
- Prisma 6 com PostgreSQL. A versão 6 é escolhida para configuração estável por `schema.prisma` e compatibilidade direta com o fluxo de migrations do monorepo.
- Vitest para testes unitários e React Testing Library para componentes críticos.

## Modelo de dados e migrations

A migration inicial cria usuários, organizações, vínculos, papéis, permissões e as entidades-base exigidas para documentos, armazenamento, servidores, backups, auditoria e notificações. IDs são UUID, relações possuem chaves estrangeiras, índices e restrições únicas. Registros pertencentes ao tenant carregam `organization_id`.

## Segurança

- Senhas com `argon2id`; segredos somente por variáveis de ambiente.
- Sessão Auth.js em cookie seguro e JWT assinado, sem expor hash ou credenciais.
- Seleção de organização validada no servidor em toda consulta e mutação.
- RBAC negado por padrão; `SUPER_ADMIN` é global e os demais papéis são vinculados à organização.
- Validação Zod em fronteiras HTTP e ações de servidor.
- Respostas sem detalhes internos; logs estruturados sem segredos.
- Fases de backup usarão `spawn`/`execFile` com allowlist, validação de argumentos, timeout e sem shell.
- Uploads futuros terão limites, nomes normalizados, armazenamento temporário controlado e remoção garantida.

## Fluxos da Fase 1

1. Seed cria permissões, papéis padrão, organização inicial e administrador quando credenciais forem fornecidas por ambiente.
2. Login valida e-mail/senha, estado do usuário e registra sessão segura.
3. Middleware protege o painel; o servidor resolve organização ativa a partir das associações autorizadas.
4. APIs de organizações e usuários aplicam sessão, tenant e permissão antes do acesso ao Prisma.
5. Dashboard apresenta métricas reais da organização e estados vazios quando não houver dados.
6. Recuperação de senha emite token aleatório, armazena somente hash e permite redefinição com validade e uso único.

## Riscos e controles

- **Vazamento entre tenants:** consultas encapsuladas exigem `organizationId` autorizado; testes cobrem negação cruzada.
- **Escalada de privilégio:** permissões são resolvidas no backend e alterações de papel exigem permissão administrativa.
- **Ambiente sem PostgreSQL:** geração e validação da migration não dependem do banco; testes de integração usam interfaces isoladas e o Compose fornece PostgreSQL para execução real.
- **Dependências externas:** versões ficam fixadas no lockfile e o build é executado ao fim da fase.
- **E-mail transacional:** a Fase 1 gera o fluxo seguro de recuperação e registra o link apenas em desenvolvimento; transporte configurável será ligado na fase de notificações.

## Ordem de implementação

- [x] Planejamento e arquitetura.
- [x] Scaffold do monorepo e configuração strict.
- [x] Schema Prisma, migration inicial e seed.
- [x] Autenticação, recuperação/alteração de senha e proteção de rotas.
- [x] Multitenancy, RBAC e APIs de organizações/usuários.
- [x] Design system Material UI, shell responsivo e dashboard.
- [x] Docker, documentação e variáveis de ambiente.
- [x] Lint, typecheck, testes e build.

## Fases posteriores

- **Fase 2:** concluída — Google Drive, documentos, pastas, upload/download, preview e auditoria funcional.
- **Fase 2.1:** concluída — secretarias, áreas de armazenamento, quotas e permissões documentais granulares.
- **Fase 3:** Redis, BullMQ, worker, servidores, descoberta Docker, MySQL e backup manual (Próxima Fase).
- **Fase 4:** scheduler, PostgreSQL, volumes, diretórios, retenção e notificações.
- **Fase 5:** restauração e novos provedores de armazenamento.

## Registro da Fase 1

Status: concluída e validada em 03/08/2026.

- Prisma schema: válido; migration SQL inicial gerada.
- Lint: aprovado sem erros.
- Typecheck: aprovado em todos os workspaces.
- Testes: 4 testes aprovados (RBAC, isolamento multiempresa e componente de métrica).
- Build: Next.js 16.3 e worker compilados com sucesso.

## Registro da Fase 2

Status: concluída e revalidada em 03/08/2026, horário de Cuiabá.

- OAuth 2.0 do Google com estado assinado e vinculado à sessão/empresa.
- Tokens criptografados com AES-256-GCM e renovação automática.
- Provider Google Drive com teste, quota, pastas, upload, download, listagem, metadados, movimentação e exclusão.
- Gerenciador com pastas, busca, upload múltiplo/arrastar e soltar, grade/lista, preview, download e lixeira.
- Metadados isolados por `organization_id`, checksum SHA-256 e arquivos somente no Drive.
- Auditoria por empresa com filtros, IP, usuário, ação e recurso.
- Upload com progresso percentual real e visualizador interno para PDF, imagem, texto e JSON.
- Movimentação pela interface, pasta raiz configurável e lixeira sincronizada com o Drive.
- Auditoria de login/logout e dashboard alimentado por quota e atividades reais.

## Fase 2.1 — Secretarias, quotas e acesso granular

Status: concluída em 04/08/2026. Todos os testes unitários de controle de cota e permissões de secretaria, além do typecheck e compilação, foram validados com sucesso.

### Hierarquia

- `Organization`: órgão principal, por exemplo Prefeitura.
- `Sector`: secretarias como Saúde, Gestão, Meio Ambiente, Engenharia e Educação.
- `StorageSpace`: área documental ou pasta raiz controlada pertencente a uma secretaria.
- Cada documento e pasta deverá pertencer à empresa, secretaria e área de armazenamento.
- Cada secretaria poderá ter uma pasta exclusiva dentro da estrutura do Google Drive.

### Quotas

- Configurar limite individual por secretaria em GB ou TB.
- Manter limite total da empresa e impedir que a soma das quotas ultrapasse a capacidade aprovada.
- Calcular consumo real por secretaria a partir dos documentos gerenciados.
- Antes do upload, validar atomicamente `uso atual + tamanho do arquivo <= limite`.
- Bloquear upload quando a quota for atingida.
- Exibir consumo, percentual disponível e alertas em 80%, 90% e 100%.
- Registrar em auditoria toda alteração de quota.
- A quota é lógica e aplicada pelo Cloud Manager; o Google Drive não oferece quota nativa por pasta.

### Usuários e permissões

- Criar vínculo `SectorUser` entre usuário e secretaria.
- Um usuário poderá participar de várias secretarias com permissões diferentes.
- Permissões mínimas por área: `ADMIN`, `EDITOR`, `VIEWER_DOWNLOAD`, `VIEWER_ONLY` e `NO_ACCESS`.
- `ADMIN`: configura área, membros, quotas, pastas e documentos.
- `EDITOR`: cria pastas, envia, renomeia, move e exclui documentos.
- `VIEWER_DOWNLOAD`: visualiza e baixa documentos.
- `VIEWER_ONLY`: utiliza preview, sem ação de download na aplicação.
- Toda listagem, preview, download e mutação deverá validar a permissão no backend.
- Registrar concessão/remoção de acesso, visualização, download e alteração de conteúdo.
- Documentar que visualização web não impede captura de tela ou cópia por meios externos.

### Interface prevista

- Tela Secretarias com nome, responsável, quota, consumo, usuários e status.
- Tela de detalhes com membros, permissões e áreas de armazenamento.
- Seletor de secretaria no cabeçalho e no gerenciador de arquivos.
- Dashboard com consumo total da Prefeitura e comparação entre secretarias.
- Administração de quotas disponível somente para perfis autorizados.
- Estados vazios, alertas de quota e confirmação para alterações críticas.

### Segurança e migration

- Criar migration para `sectors`, `sector_users` e `storage_spaces` e adicionar referências aos documentos/pastas.
- Índices e restrições únicas sempre compostos com `organization_id`.
- Migrar registros atuais para uma secretaria padrão sem perder documentos ou histórico.
- Negar acesso por padrão e testar vazamento entre empresas, secretarias e áreas.
- Nenhuma permissão poderá depender somente da interface.

## Registro do trabalho — 03/08/2026

### Entregas realizadas

- Projeto configurado e executando localmente em Docker na porta `3002`.
- PostgreSQL e Redis mantidos em rede interna, ambos com healthcheck.
- Login corrigido, erro técnico do Auth.js redirecionado para a tela de acesso e alternância claro/escuro corrigida.
- Administrador inicial validado com a empresa `Minha empresa`.
- Migration inicial e migration `20260804010000_phase2_documents` aplicadas.
- Google OAuth configurado e conexão real validada com conta de teste.
- Tokens Google criptografados com AES-256-GCM e renovação automática.
- Quota real do Google Drive exibida em Integrações, Configurações e Dashboard.
- Gerenciador de arquivos com pastas, upload múltiplo, arrastar e soltar, progresso, busca, grade/lista, breadcrumbs, movimentação, renomeação e lixeira.
- Preview próprio para PDF, imagem, texto e JSON; fallback com download para demais formatos.
- Falha de preview causada por conversão incorreta de `ReadableStream` corrigida e validada com PDF real.
- Pastas e Configurações deixaram de ser placeholders e agora exibem dados reais.
- Auditoria de autenticação e ações documentais implementada.
- Dashboard com gráfico e atividades reais, descrições em português e quota do Drive.
- Fuso de todas as datas visíveis centralizado em `America/Cuiaba`.
- `PLAN.md`, `README.md` e documentação do Google Drive atualizados.

### Validação final do dia

- Lint: aprovado.
- Typecheck strict: aprovado.
- Testes: 9 aprovados.
- Build Next.js/worker: aprovado.
- Web, PostgreSQL e Redis: saudáveis.
- Health endpoint: `http://localhost:3002/api/health` retornando `200`.

### Como retomar o projeto

No PowerShell:

```powershell
cd C:\xampp\htdocs\producao\i7ai-cloud-manager
docker compose up -d
docker compose ps
curl.exe http://localhost:3002/api/health
```

Abrir `http://localhost:3002/login`. O `.env` local já contém a configuração utilizada hoje e não deve ser versionado ou compartilhado. Se houver alteração de código, reconstruir somente o web:

```powershell
docker compose build web
docker compose up -d --no-deps web
```

Se houver migration nova, aplicá-la antes de publicar a nova imagem. Antes de encerrar uma etapa, executar:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Para parar sem apagar banco, Redis ou arquivos persistentes:

```powershell
docker compose stop
```

Não executar `docker compose down -v`, pois a opção `-v` remove os volumes persistentes.

### Próximo passo

Iniciar a Fase 2.1 pelo schema Prisma e pela migration segura dos documentos atuais para uma secretaria padrão. Depois implementar autorização por secretaria, quotas no backend e as telas administrativas. Não iniciar a Fase 3 antes de validar essa etapa.
