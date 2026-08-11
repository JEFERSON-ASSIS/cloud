import { StorageProviderError } from "@i7ai/storage";

const PROVIDER_DETAIL =
  /google|drive|oauth|token|credenciais?|refresh|integrações|upload session|resumível.*remot/i;

export function userFacingStorageError(
  error: unknown,
  role?: string | null,
  fallback = "Não foi possível concluir a operação no armazenamento em nuvem.",
) {
  const message = error instanceof Error ? error.message : fallback;
  if (role === "SUPER_ADMIN") return message;
  if (error instanceof StorageProviderError || PROVIDER_DETAIL.test(message)) {
    return `${fallback} Tente novamente ou contate o administrador.`;
  }
  return message;
}
