# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Cliente PostgreSQL 17 (repositório oficial do PostgreSQL): o pg_dump faz backup de servidores da mesma versão ou
# mais antigos; o pacote padrão do Debian 12 é o 15 e recusa servidores 16/17 ("server version mismatch").
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates curl default-mysql-client gzip tar coreutils \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL --http1.1 --retry 5 --retry-all-errors --retry-delay 3 -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-17 \
    && apt-get purge -y curl && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
COPY package.json package-lock.json turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/backup-core/package.json packages/backup-core/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/security/package.json packages/security/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/types/package.json packages/types/package.json
RUN npm ci --no-audit --no-fund

FROM dependencies AS builder
COPY . .
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ARG AUTH_SECRET=build-time-secret-with-at-least-32-characters
ENV DATABASE_URL=$DATABASE_URL AUTH_SECRET=$AUTH_SECRET
RUN npm run build

FROM base AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs -m nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/argon2 ./node_modules/argon2
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

FROM dependencies AS worker
# Cliente do Docker (só o binário, sem daemon): os backups do tipo "Volume Docker" rodam `docker run` no Docker do
# host, pelo /var/run/docker.sock montado no serviço. Sem ele: "spawn docker ENOENT".
ADD https://download.docker.com/linux/static/stable/x86_64/docker-27.5.1.tgz /tmp/docker.tgz
RUN tar -xzf /tmp/docker.tgz -C /usr/local/bin --strip-components=1 docker/docker && rm /tmp/docker.tgz && docker --version
COPY . .
ENV NODE_ENV=production
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma
CMD ["npm", "run", "start", "-w", "@i7ai/worker"]

