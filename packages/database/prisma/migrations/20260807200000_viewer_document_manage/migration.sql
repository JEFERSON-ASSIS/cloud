-- VIEWER também pode gerenciar documentos (upload/pastas), alinhado ao menu Arquivos.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.name = 'VIEWER'
  AND p.key = 'document.manage'
ON CONFLICT DO NOTHING;
