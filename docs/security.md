# Segurança

Senhas usam Argon2id. Tokens de recuperação são aleatórios, armazenados somente como SHA-256, expiram em 30 minutos e são de uso único. Sessões expiram em oito horas. Permissões são validadas no servidor e consultas recebem a organização autorizada.

Segredos não devem aparecer no código, imagens ou logs. Credenciais de storage e servidores serão criptografadas com a chave de ambiente. A execução de processos de backup será feita sem shell, com executáveis permitidos, argumentos validados e timeout.
