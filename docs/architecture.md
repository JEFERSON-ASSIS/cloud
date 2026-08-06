# Arquitetura

O navegador acessa o Next.js, que autentica com Auth.js e executa Route Handlers/Server Components. Toda operação resolve uma sessão de tenant antes do Prisma. PostgreSQL persiste metadados e Redis será usado pelo worker BullMQ a partir da Fase 3. Integrações externas ficam atrás de contratos em `packages/storage`.

O monorepo isola aplicações de pacotes de domínio. Rotas permanecem finas; autorização está em `packages/security`, banco em `packages/database` e contratos compartilhados em `packages/types`.
