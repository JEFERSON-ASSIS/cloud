-- CreateTable
CREATE TABLE "role_menu_items" (
    "role_id" UUID NOT NULL,
    "menu_key" TEXT NOT NULL,

    CONSTRAINT "role_menu_items_pkey" PRIMARY KEY ("role_id","menu_key")
);

-- CreateIndex
CREATE INDEX "role_menu_items_menu_key_idx" ON "role_menu_items"("menu_key");

-- AddForeignKey
ALTER TABLE "role_menu_items" ADD CONSTRAINT "role_menu_items_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed inicial alinhado às permissões atuais do menu (exceto itens superAdminOnly).
INSERT INTO "role_menu_items" ("role_id", "menu_key")
SELECT r.id, v.menu_key
FROM "roles" r
CROSS JOIN (
  VALUES
    ('dashboard'),
    ('secretarias'),
    ('arquivos'),
    ('pastas'),
    ('backups'),
    ('agendamentos'),
    ('servidores'),
    ('integracoes'),
    ('usuarios'),
    ('auditoria'),
    ('logs'),
    ('configuracoes')
) AS v(menu_key)
WHERE r.name = 'ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO "role_menu_items" ("role_id", "menu_key")
SELECT r.id, v.menu_key
FROM "roles" r
CROSS JOIN (
  VALUES
    ('dashboard'),
    ('secretarias'),
    ('arquivos'),
    ('pastas'),
    ('backups'),
    ('agendamentos'),
    ('usuarios'),
    ('auditoria'),
    ('logs'),
    ('configuracoes')
) AS v(menu_key)
WHERE r.name = 'MANAGER'
ON CONFLICT DO NOTHING;

INSERT INTO "role_menu_items" ("role_id", "menu_key")
SELECT r.id, v.menu_key
FROM "roles" r
CROSS JOIN (
  VALUES
    ('dashboard'),
    ('arquivos'),
    ('pastas'),
    ('backups'),
    ('agendamentos')
) AS v(menu_key)
WHERE r.name = 'OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO "role_menu_items" ("role_id", "menu_key")
SELECT r.id, v.menu_key
FROM "roles" r
CROSS JOIN (
  VALUES
    ('dashboard'),
    ('arquivos'),
    ('pastas'),
    ('backups')
) AS v(menu_key)
WHERE r.name = 'VIEWER'
ON CONFLICT DO NOTHING;
