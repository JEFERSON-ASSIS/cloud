# Meu perfil e compartilhamentos entre secretarias

## Meu perfil

O menu **Meu perfil** é visível para todo usuário autenticado. A tela permite alterar o nome e trocar a senha.

A troca de senha exige:

- senha atual correta;
- nova senha com pelo menos 8 caracteres;
- confirmação igual à nova senha;
- nova senha diferente da senha atual.

O e-mail é exibido como informação da conta e não pode ser alterado nessa tela. Alterações são registradas na auditoria como `PROFILE_UPDATE` ou `PASSWORD_CHANGE`.

## Compartilhamentos

O compartilhamento é uma autorização interna do Cloud Manager. O arquivo ou a pasta não é movido, copiado ou duplicado no armazenamento, portanto continua contando somente na quota da secretaria de origem.

Somente `EDITOR`, `ADMIN` da secretaria ou administradores da organização podem compartilhar. O destino pode ser:

- toda uma secretaria; ou
- um usuário ativo que pertença à secretaria de destino.

As permissões disponíveis são:

- `VIEW`: visualizar, sem download;
- `DOWNLOAD`: visualizar e baixar.

Uma pasta compartilhada concede a mesma permissão aos seus arquivos e subpastas. O destinatário não pode renomear, mover, excluir ou enviar conteúdo para a pasta de origem.

Na secretaria de destino, a raiz de Arquivos exibe **Compartilhados comigo** quando existe ao menos um acesso ativo. A caixa de compartilhamento do item de origem mostra todos os destinatários e permite revogar cada acesso.

Eventos de criação, revogação, visualização e download compartilhado são registrados na auditoria.

## Banco de dados

Antes de publicar a imagem Web, execute:

```bash
npm run db:migrate
```

A migration `20260811143000_document_sharing` cria:

- enum `DocumentSharePermission`;
- tabela `document_shares`;
- restrição de exatamente um recurso por compartilhamento;
- restrição que impede origem e destino iguais;
- chaves estrangeiras, índices de consulta e chave de idempotência.

## Validação em produção

1. Entrar como editor da secretaria A.
2. Compartilhar um arquivo com toda a secretaria B usando `VIEW`.
3. Entrar como usuário da secretaria B e confirmar que o item aparece em **Compartilhados comigo**.
4. Confirmar que a visualização funciona e o download não aparece.
5. Alterar o acesso para `DOWNLOAD` e confirmar o download.
6. Compartilhar uma pasta e validar arquivos e subpastas.
7. Revogar o acesso e confirmar que o item desaparece imediatamente do destino.
8. Confirmar os eventos em Auditoria.

## Reversão

A imagem Web anterior pode ser restaurada sem remover a tabela. Não exclua a migration nem a tabela durante uma reversão de aplicação; manter os registros preserva auditoria e permite retomar a funcionalidade sem perda de configuração.
