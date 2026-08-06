# Docker

`docker-compose.yml` oferece web, worker, PostgreSQL e Redis com healthchecks, volumes e rede interna. Apenas a porta web é publicada. Use `docker compose up --build` após configurar `.env`.

O override de produção remove a publicação direta do web e adiciona labels Traefik/Swarm. Crie previamente a rede externa `traefik-public`.
