# Produção

Use imagens imutáveis, segredos do orquestrador e TLS no Traefik. Aplique `npm run db:migrate` uma vez antes de trocar o tráfego. Execute o seed somente quando necessário. Monitore `/api/health`, logs estruturados, PostgreSQL e Redis.

Faça backup do PostgreSQL e teste restauração fora do ambiente principal. Nunca exponha PostgreSQL ou Redis à Internet.
