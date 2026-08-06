# Backups

As entidades de fontes, agendas, execuções, arquivos e logs existem desde a migration inicial. A Fase 3 implementará MySQL manual e upload; a Fase 4 adicionará PostgreSQL, volumes, diretórios, scheduler e retenção.

Arquivos locais nunca serão removidos antes de upload confirmado, existência remota e checksum válido. Dumps lógicos têm prioridade sobre cópia de volumes de bancos.
