Quero que você construa um projeto completo chamado:

i7AI Cloud Manager

O sistema será uma plataforma web moderna para:

1. Gerenciamento de documentos.
2. Upload de arquivos.
3. Armazenamento direto no Google Drive.
4. Gestão de usuários e permissões.
5. Gestão de empresas/organizações.
6. Backup automático de bancos MySQL.
7. Backup automático de bancos PostgreSQL.
8. Backup de volumes Docker e diretórios.
9. Histórico de backups.
10. Auditoria.
11. Agendamentos automáticos.
12. Futuramente restauração de backups.
13. Futuramente suporte a Amazon S3, Backblaze B2, OneDrive e MinIO.

O projeto deverá ter arquitetura profissional, escalável e preparada para produção.

IMPORTANTE:

- Não criar apenas um protótipo visual.
- Implementar funcionalidades reais.
- Não usar pseudocódigo.
- Não deixar TODO no lugar de funcionalidades importantes.
- Não omitir arquivos necessários.
- Não utilizar mocks como solução definitiva.
- Todo código deverá ser completo.
- TypeScript deverá estar em modo strict.
- Criar tratamento de erros.
- Criar logs.
- Criar validações.
- Criar testes das funcionalidades mais importantes.
- Nunca salvar senhas ou tokens diretamente no código.
- Utilizar variáveis de ambiente.
- Não executar comandos de shell diretamente com valores fornecidos pelo usuário.
- Implementar segurança contra command injection, path traversal, SSRF e acesso indevido entre empresas.

============================================================
1. STACK PRINCIPAL
============================================================

Frontend / Web:

- Next.js versão estável atual
- App Router
- React
- TypeScript strict
- Material UI versão estável atual
- MUI X Data Grid
- Material Icons / Lucide quando necessário
- React Hook Form
- Zod
- TanStack Query
- Recharts
- date-fns

Backend:

- Next.js Route Handlers
- Node.js
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis
- BullMQ

Worker:

Criar um worker Node.js separado para tarefas demoradas:

- backup MySQL
- backup PostgreSQL
- backup Docker
- backup de diretórios
- compressão
- checksum
- upload Google Drive
- retenção
- limpeza
- verificação
- notificações

Autenticação:

- Auth.js
- login por e-mail e senha
- sessão segura
- RBAC

Infraestrutura:

- Docker
- Docker Compose
- compatível com Docker Swarm
- Redis
- PostgreSQL
- web
- worker
- healthchecks
- Traefik ready

Integrações:

- Google Drive API
- Google OAuth 2.0

============================================================
2. DESIGN SYSTEM
============================================================

Utilizar Material UI como biblioteca principal.

NÃO utilizar Bootstrap.

NÃO utilizar Tailwind como framework principal de componentes.

Evitar misturar várias bibliotecas visuais.

Criar design system centralizado em:

src/theme/
    theme.ts
    palette.ts
    typography.ts
    components.ts

Configurar:

- Light Mode
- Dark Mode
- CSS Variables do MUI
- ThemeProvider
- AppRouterCacheProvider para Next.js App Router
- responsividade
- tipografia moderna
- espaçamento consistente
- bordas suaves
- cards modernos
- aparência SaaS empresarial

Tema visual:

- moderno
- profissional
- limpo
- tecnológico
- corporativo
- sem aparência antiquada
- sem visual genérico de painel Bootstrap

Criar componentes reutilizáveis:

src/components/
    AppShell/
    Sidebar/
    Header/
    PageHeader/
    Breadcrumbs/
    MetricCard/
    StatusChip/
    ConfirmDialog/
    EmptyState/
    FileUploader/
    FileBrowser/
    DataTable/
    LoadingState/
    ErrorState/
    SearchBar/
    StorageUsage/
    ActivityTimeline/
    BackupStatus/
    ProgressDialog/

============================================================
3. LAYOUT
============================================================

Criar estrutura principal:

Sidebar esquerda:

- Dashboard
- Arquivos
- Pastas
- Backups
- Agendamentos
- Servidores
- Integrações
- Usuários
- Empresas
- Auditoria
- Logs
- Configurações

Header:

- busca
- notificações
- dark/light mode
- usuário logado
- empresa selecionada
- menu do perfil

Sidebar:

- recolhível
- responsiva
- mobile drawer
- manter estado recolhido

============================================================
4. MULTIEMPRESA / MULTITENANT
============================================================

O sistema deverá ser multiempresa desde o início.

Criar entidades:

organizations
users
organization_users

Cada usuário poderá participar de uma ou mais organizações.

Perfis:

SUPER_ADMIN
ADMIN
MANAGER
OPERATOR
VIEWER

Permissões deverão ser validadas no backend.

Nunca confiar apenas na interface.

Todo documento, backup, servidor, integração e configuração deverá pertencer a uma organization_id.

Impedir totalmente que um usuário de uma organização veja dados de outra organização.

============================================================
5. AUTENTICAÇÃO
============================================================

Implementar:

- login
- logout
- recuperação de senha
- alteração de senha
- sessão
- refresh seguro
- proteção das rotas
- middleware
- RBAC

Criar uma tela de login moderna usando Material UI.

============================================================
6. GOOGLE DRIVE
============================================================

Criar integração completa com Google Drive.

Fluxo:

Configurações
→ Integrações
→ Google Drive
→ Conectar Google Drive
→ OAuth Google
→ Callback
→ salvar conexão
→ testar conexão
→ selecionar pasta raiz

Implementar:

- Google OAuth 2.0
- access_token
- refresh_token
- expiração
- renovação automática
- revogação
- teste da conexão
- desconexão

Tokens devem ser criptografados antes de serem salvos.

Nunca salvar tokens em texto puro.

Criar storage provider abstraction:

StorageProvider

Métodos:

connect()
testConnection()
upload()
download()
delete()
list()
createFolder()
getMetadata()
verify()
getQuota()

Implementar:

GoogleDriveStorageProvider

Preparar arquitetura para futuramente:

S3StorageProvider
BackblazeStorageProvider
OneDriveStorageProvider
MinioStorageProvider
SFTPStorageProvider

============================================================
7. DOCUMENTOS
============================================================

Criar módulo completo de documentos.

O usuário deverá poder:

- criar pastas
- criar subpastas
- enviar arquivo
- enviar múltiplos arquivos
- arrastar e soltar arquivos
- visualizar
- baixar
- renomear
- mover
- excluir
- restaurar da lixeira
- buscar
- filtrar
- ordenar

O arquivo deverá ser enviado para o Google Drive.

O banco PostgreSQL deverá armazenar apenas metadados.

Exemplo de campos:

documents

id
organization_id
folder_id
uploaded_by
storage_connection_id
storage_file_id
name
original_name
mime_type
extension
size
checksum_sha256
status
created_at
updated_at
deleted_at

folders

id
organization_id
parent_id
name
storage_folder_id
created_by
created_at
updated_at

Nunca armazenar o documento permanentemente dentro do container web.

Upload temporário deverá ser removido após envio confirmado.

============================================================
8. INTERFACE DE ARQUIVOS
============================================================

Criar interface semelhante a um gerenciador de arquivos moderno.

Topo:

Arquivos

[ Novo ]
[ Upload ]
[ Nova pasta ]

Busca.

Alternância:

Grid
Lista

Mostrar:

- nome
- tipo
- tamanho
- proprietário
- atualizado em

Ações:

- visualizar
- baixar
- renomear
- mover
- excluir
- detalhes

Criar breadcrumbs de pastas.

Exemplo:

Documentos / Prefeitura de Vera / Educação / 2026

Criar drag-and-drop de uploads.

Criar progresso real de upload.

============================================================
9. PREVIEW
============================================================

Implementar preview para:

- PDF
- imagens
- texto
- JSON

Quando não for possível visualizar:

Mostrar ícone do arquivo e botão Download.

============================================================
10. AUDITORIA
============================================================

Registrar todas as ações importantes.

Exemplos:

LOGIN
LOGOUT
DOCUMENT_UPLOAD
DOCUMENT_DOWNLOAD
DOCUMENT_DELETE
DOCUMENT_MOVE
DOCUMENT_RENAME
FOLDER_CREATE
FOLDER_DELETE
BACKUP_STARTED
BACKUP_COMPLETED
BACKUP_FAILED
BACKUP_DELETED
GOOGLE_DRIVE_CONNECTED
GOOGLE_DRIVE_DISCONNECTED
USER_CREATED
USER_UPDATED
USER_DELETED
ROLE_CHANGED

Tabela:

audit_logs

id
organization_id
user_id
action
resource_type
resource_id
ip
user_agent
metadata
created_at

Criar tela:

Auditoria

com:

- usuário
- ação
- recurso
- data
- IP
- filtros

============================================================
11. DASHBOARD
============================================================

Criar dashboard profissional.

Cards:

- Total de documentos
- Armazenamento usado
- Backups realizados
- Backups com erro
- Usuários ativos
- Integrações ativas

Gráficos:

- uploads nos últimos 30 dias
- armazenamento por tipo
- backups por status
- atividade por dia

Mostrar:

Atividades recentes.

Backups recentes.

Alertas.

============================================================
12. BACKUPS
============================================================

Criar módulo de backup separado dos documentos.

Tipos:

MYSQL
POSTGRESQL
DOCKER_VOLUME
DIRECTORY

Entidades:

backup_sources
backup_schedules
backup_runs
backup_files
backup_logs

============================================================
13. DESCOBERTA DE MYSQL
============================================================

O ambiente utiliza Docker e Docker Swarm.

O sistema deverá descobrir containers e serviços dinamicamente.

Nunca utilizar Container ID fixo.

Usar:

docker ps
docker service ls
docker service ps
docker inspect

Permitir cadastrar:

nome do serviço Docker

Exemplo:

mysql_mysql

Descobrir dinamicamente o container atual.

============================================================
14. BACKUP MYSQL
============================================================

Utilizar mysqldump.

Um arquivo por banco.

Opções:

--single-transaction
--quick
--routines
--triggers
--events
--hex-blob
--default-character-set=utf8mb4

Compactar usando gzip.

Gerar:

SHA-256
tamanho
tempo de execução

Capturar:

stdout
stderr
exit code

Excluir por padrão:

information_schema
performance_schema
sys

Permitir opcionalmente incluir:

mysql

Nunca utilizar senha na linha de comando de maneira insegura.

Usar secrets ou arquivo temporário protegido.

============================================================
15. POSTGRESQL
============================================================

Utilizar:

pg_dump

Formato custom.

Um banco por arquivo.

Implementar:

backup
checksum
compressão
upload
verificação

Preparar restauração futura usando pg_restore.

============================================================
16. DOCKER VOLUMES
============================================================

Listar:

docker volume ls

Permitir selecionar volumes.

Backup usando container auxiliar.

Exemplo conceitual:

docker run --rm
-v volume:/source:ro
-v backup:/backup
alpine
tar -czf ...

Nunca montar volumes com permissão de escrita durante backup.

Validar nomes de volume.

Impedir command injection.

Volumes de MySQL/PostgreSQL deverão exibir alerta.

Para banco de dados, priorizar dump lógico.

============================================================
17. DIRETÓRIOS
============================================================

Permitir backup de diretórios autorizados.

Nunca permitir caminho arbitrário informado pelo usuário.

Criar allowlist.

Exemplos:

/root/stacks
/opt
/etc/traefik
/data/uploads

Impedir:

../
symlink traversal
path traversal

============================================================
18. WORKER
============================================================

Todas as tarefas pesadas devem ser executadas pelo worker.

Nunca executar backup pesado dentro da requisição HTTP.

Criar filas BullMQ:

backup
upload
cleanup
notification
verification

Jobs:

DiscoverDockerJob
DiscoverMysqlJob
DiscoverPostgresJob
CreateMysqlBackupJob
CreatePostgresBackupJob
CreateVolumeBackupJob
CreateDirectoryBackupJob
CalculateChecksumJob
UploadToDriveJob
VerifyRemoteFileJob
CleanupBackupJob
SendNotificationJob

============================================================
19. PROGRESSO
============================================================

Criar atualização de progresso.

Inicialmente utilizar polling com TanStack Query.

Preparar arquitetura para WebSocket/SSE.

Estados:

PENDING
PREPARING
RUNNING
COMPRESSING
CHECKSUM
UPLOADING
VERIFYING
COMPLETED
FAILED

Exibir:

- percentual
- etapa
- arquivo
- banco
- tamanho
- duração
- erro

============================================================
20. BACKUP SCHEDULE
============================================================

Permitir:

Diário
Semanal
Mensal

Configurar:

horário
timezone
fontes
destinos
retenção
ativar/desativar

Default:

timezone America/Cuiaba

Criar scheduler.

Pode utilizar:

BullMQ Job Scheduler
ou um scheduler Node confiável.

Evitar depender exclusivamente do browser.

============================================================
21. RETENÇÃO
============================================================

Implementar:

7 backups diários
4 backups semanais
6 backups mensais

Configuração deverá ser personalizável.

Nunca apagar backup local antes de confirmar:

1. upload concluído;
2. arquivo remoto existe;
3. checksum válido.

============================================================
22. GOOGLE DRIVE PARA BACKUPS
============================================================

Criar estrutura automática:

i7AI Cloud/
    Backups/
        organization-name/
            MySQL/
                2026/
                    08/
                        03/
            PostgreSQL/
            Docker/
            Files/

Para documentos:

i7AI Cloud/
    Documents/
        organization-name/

Nunca depender do nome da pasta para localizar arquivos.

Sempre armazenar IDs do Google Drive.

============================================================
23. BACKUPS - TELA
============================================================

Criar tela Material UI.

Topo:

Backups

[ Executar Backup ]

Cards:

Último Backup
Próximo Backup
Sucesso 30 dias
Falhas
Espaço utilizado

Tabela:

Sistema
Origem
Tipo
Data
Tamanho
Duração
Destino
Status

Ações:

Detalhes
Logs
Baixar
Verificar
Excluir

Restauração ficará preparada para fase futura.

============================================================
24. SERVIDORES
============================================================

Criar cadastro de servidores.

Campos:

name
host
port
username
authentication_type
encrypted_password
encrypted_private_key
status

Permitir:

testar conexão
editar
ativar/desativar

Utilizar SSH quando o backup ocorrer em servidor remoto.

Usar biblioteca SSH confiável para Node.

Nunca utilizar entrada do usuário diretamente em comando shell.

============================================================
25. SEGURANÇA DE COMMAND EXECUTION
============================================================

Criar uma camada própria:

SafeProcessExecutor

Ela deverá:

- usar spawn/execFile, nunca concatenação de shell;
- receber argumentos separados;
- validar comandos permitidos;
- validar argumentos;
- aplicar timeout;
- limitar recursos quando possível;
- capturar stdout;
- capturar stderr;
- retornar exit code;
- matar processo quando ultrapassar timeout.

Comandos permitidos:

docker
mysqldump
pg_dump
gzip
tar
sha256sum

Nunca permitir executar comando fornecido diretamente pelo usuário.

============================================================
26. BANCO POSTGRESQL / PRISMA
============================================================

Criar schema Prisma completo.

Entidades mínimas:

User
Organization
OrganizationUser
Role
Permission
RolePermission
StorageConnection
GoogleDriveConnection
Folder
Document
Server
BackupSource
BackupSchedule
BackupScheduleSource
BackupRun
BackupFile
BackupLog
AuditLog
NotificationSetting

Adicionar:

foreign keys
indexes
unique constraints
createdAt
updatedAt
deletedAt quando necessário

Utilizar UUID ou CUID.

============================================================
27. TELA DE USUÁRIOS
============================================================

Criar:

Usuários

Tabela:

Nome
Email
Empresa
Perfil
Status
Último acesso

Ações:

Editar
Bloquear
Excluir
Alterar perfil

Criar modal para convidar usuário.

============================================================
28. TELA DE EMPRESAS
============================================================

Criar:

Empresas

Campos:

name
slug
document
status
storage_limit

Mostrar:

usuários
documentos
espaço utilizado
backups
status

============================================================
29. INTEGRAÇÕES
============================================================

Criar tela:

Integrações

Cards:

Google Drive
Amazon S3 - Em breve
Backblaze B2 - Em breve
OneDrive - Em breve
MinIO - Em breve

Google Drive deverá ser funcional.

Mostrar:

Conectado
Conta
Espaço utilizado
Último teste

Botões:

Conectar
Testar
Desconectar
Configurar

============================================================
30. LOGS
============================================================

Tela:

Logs

Filtros:

tipo
nível
data
backup
servidor

Níveis:

DEBUG
INFO
WARNING
ERROR
CRITICAL

Não armazenar senhas ou tokens nos logs.

============================================================
31. NOTIFICAÇÕES
============================================================

Preparar:

Email
Webhook
Telegram
WhatsApp via webhook

Eventos:

backup concluído
backup falhou
upload falhou
Google Drive desconectado
Google Drive sem espaço
backup corrompido

============================================================
32. DOCKER
============================================================

Criar:

Dockerfile
docker-compose.yml
docker-compose.production.yml

Serviços:

web
worker
postgres
redis

Adicionar:

healthchecks
restart policy
volumes persistentes
network interna

Não expor PostgreSQL ou Redis publicamente.

Preparar labels de exemplo para Traefik.

============================================================
33. ESTRUTURA DO PROJETO
============================================================

Preferencialmente usar monorepo.

Exemplo:

apps/
    web/
    worker/

packages/
    database/
    config/
    types/
    backup-core/
    storage/
    security/

docs/

docker/

scripts/

============================================================
34. TESTES
============================================================

Criar testes usando Vitest ou Jest.

Cobrir principalmente:

autenticação
RBAC
multitenancy
upload
Google Drive provider
document permission
backup commands
SafeProcessExecutor
path validation
checksum
retenção

Nunca executar comandos destrutivos durante testes.

Utilizar mocks/fixtures APENAS dentro dos testes.

============================================================
35. README
============================================================

Criar README.md completo com:

- visão geral
- arquitetura
- stack
- instalação
- Docker
- desenvolvimento
- produção
- variáveis de ambiente
- banco
- migrations
- Google Cloud
- Google Drive API
- OAuth
- workers
- Redis
- backups
- segurança
- troubleshooting

Criar também:

docs/architecture.md
docs/google-drive.md
docs/security.md
docs/backups.md
docs/docker.md
docs/production.md
docs/disaster-recovery.md

============================================================
36. VARIÁVEIS DE AMBIENTE
============================================================

Criar .env.example.

Nunca criar credenciais reais.

Exemplo de categorias:

APP_URL
NEXTAUTH_SECRET
DATABASE_URL
REDIS_URL

GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI

ENCRYPTION_KEY

TEMP_BACKUP_PATH
MAX_UPLOAD_SIZE

============================================================
37. FASES DE IMPLEMENTAÇÃO
============================================================

NÃO tente implementar tudo sem organização.

Criar primeiro:

PLAN.md

Descrever:

arquitetura
dependências
migrations
segurança
fluxos
riscos
ordem da implementação

Depois implementar por fases.

FASE 1:

- monorepo
- Next.js
- Material UI
- autenticação
- multiempresa
- usuários
- RBAC
- Prisma/PostgreSQL
- dashboard
- layout completo

FASE 2:

- Google Drive OAuth
- integração Google Drive
- gerenciamento de documentos
- pastas
- upload
- download
- preview
- auditoria

FASE 3:

- Redis
- BullMQ
- worker
- servidores
- descoberta Docker
- MySQL
- backup manual
- upload do backup para Drive
- histórico
- logs

FASE 4:

- scheduler
- PostgreSQL
- Docker volumes
- diretórios
- retenção
- notificações

FASE 5:

- restauração
- S3
- Backblaze
- OneDrive
- MinIO
- disaster recovery

============================================================
38. PRIMEIRA EXECUÇÃO
============================================================

Comece agora pela FASE 1.

Antes de escrever código:

1. leia todo este requisito;
2. crie PLAN.md;
3. defina a arquitetura;
4. escolha versões compatíveis das dependências;
5. crie a estrutura do monorepo;
6. configure TypeScript strict;
7. configure Material UI corretamente com Next.js App Router;
8. configure Prisma;
9. configure PostgreSQL;
10. crie migrations;
11. crie autenticação;
12. crie multitenancy;
13. crie RBAC;
14. crie layout;
15. crie dashboard;
16. execute lint;
17. execute typecheck;
18. execute testes;
19. corrija erros encontrados.

============================================================
39. CRITÉRIOS VISUAIS
============================================================

O projeto deverá parecer um SaaS premium.

Usar:

- sidebar escura ou neutra
- conteúdo claro
- cards bem espaçados
- ícones consistentes
- data grids modernos
- skeletons
- dialogs profissionais
- tooltips
- menus
- breadcrumbs
- estados vazios bem desenhados
- responsividade

Evitar:

- gradientes exagerados
- cores chamativas demais
- sombras exageradas
- elementos enormes
- painel com aparência antiga
- excesso de bordas

Priorizar:

- legibilidade
- usabilidade
- velocidade
- clareza
- consistência

============================================================
40. ENTREGA AO FINAL DA FASE
============================================================

Ao terminar cada fase:

1. execute:
   - lint
   - typecheck
   - testes
   - build

2. corrija todos os erros encontrados.

3. atualize PLAN.md.

4. atualize README.md.

5. apresente um resumo contendo:
   - arquivos criados
   - funcionalidades implementadas
   - migrations criadas
   - endpoints criados
   - componentes criados
   - comandos para executar
   - variáveis necessárias
   - como testar
   - problemas pendentes
   - próxima fase

Não avance automaticamente para uma fase posterior sem primeiro garantir que a fase atual compila e está funcional.