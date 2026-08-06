# i7AI Cloud Manager

Plataforma web multiempresa para gestão de documentos e backups. As Fases 1 e 2 entregam autenticação, RBAC, isolamento por organização, dashboard, integração Google Drive, gerenciador de documentos/pastas e auditoria.

## Arquitetura e stack

- Next.js 16 App Router, React 19, TypeScript strict e Material UI 9.
- Auth.js com credenciais, Argon2id e sessão JWT segura.
- PostgreSQL 17, Prisma 6, Redis 8 e Turborepo com npm workspaces.
- Aplicações separadas em `apps/web` e `apps/worker`; pacotes reutilizáveis em `packages/`.

Detalhes: [arquitetura](docs/architecture.md), [segurança](docs/security.md), [Docker](docs/docker.md) e [produção](docs/production.md).

## Desenvolvimento

1. Copie `.env.example` para `.env` e substitua todos os segredos de exemplo.
2. Inicie PostgreSQL e Redis: `docker compose up -d postgres redis`.
3. Instale dependências: `npm ci`.
4. Aplique a migration: `npm run db:migrate`.
5. Crie papéis e administrador: `npm run db:seed`.
6. Inicie o sistema: `npm run dev`.

Na instalação local atual, abra `http://localhost:3002`. Para criar o administrador inicial, defina `INITIAL_ADMIN_EMAIL` e uma `INITIAL_ADMIN_PASSWORD` de no mínimo 12 caracteres antes do seed.

### Retomar o ambiente Docker local

```powershell
cd C:\xampp\htdocs\producao\i7ai-cloud-manager
docker compose up -d
docker compose ps
curl.exe http://localhost:3002/api/health
```

Para parar preservando os volumes: `docker compose stop`. Não utilize `docker compose down -v` se desejar manter PostgreSQL e Redis.

## Comandos

- `npm run dev`: desenvolvimento.
- `npm run lint`: lint de todos os workspaces.
- `npm run typecheck`: TypeScript strict.
- `npm test`: testes unitários.
- `npm run build`: build de produção.
- `npm run db:generate`: gera o Prisma Client.
- `npm run db:migrate`: aplica migrations pendentes.
- `npm run db:seed`: cria RBAC e, opcionalmente, o administrador inicial.

## Variáveis de ambiente

As variáveis estão documentadas em `.env.example`. `AUTH_SECRET`, `DATABASE_URL` e `ENCRYPTION_KEY` são obrigatórias em produção. Gere segredos aleatórios com uma ferramenta criptograficamente segura e nunca versione o `.env`.

## Banco e migrations

O schema fica em `packages/database/prisma/schema.prisma`. A migration inicial cria todas as entidades-base solicitadas, mesmo quando sua interface pertence a uma fase posterior. Dados de negócio possuem `organization_id`, índices e chaves estrangeiras.

## Google Drive, workers e backups

O Google Drive está implementado com OAuth 2.0, renovação de tokens, criptografia e isolamento por empresa. Configure as credenciais do Google Cloud antes de conectar. Filas, worker BullMQ e backup manual pertencem à Fase 3. Veja [Google Drive](docs/google-drive.md) e [backups](docs/backups.md).

O módulo de arquivos oferece upload múltiplo com progresso, pastas, movimentação, busca, grade/lista, preview de PDF, imagens, texto e JSON, download e lixeira sincronizada. A tela de Integrações permite testar a conexão, consultar quota e escolher uma pasta raiz do Google Drive.

## Testes e troubleshooting

Execute `npm test`. Se a saúde retornar `503`, confirme `DATABASE_URL`, o container PostgreSQL e as migrations. Se o login falhar, execute o seed e confirme que usuário, organização e vínculo estão ativos. Não use o segredo placeholder do build em execução real.
