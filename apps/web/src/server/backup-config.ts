const SECRET_KEY_PATTERN = /(password|secret|token|private.?key|access.?key)/i;

export function sanitizeBackupConfig(config: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(config).filter(([key]) => !SECRET_KEY_PATTERN.test(key)),
  );
}

export function mergeBackupConfig(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>,
) {
  const merged = { ...current, ...incoming };
  for (const [key, value] of Object.entries(incoming)) {
    if (SECRET_KEY_PATTERN.test(key) && (value === "" || value === null)) {
      if (key in current) merged[key] = current[key];
      else delete merged[key];
    }
  }
  return merged;
}

export function hasBackupSecrets(config: Record<string, unknown>) {
  return Object.keys(config).some((key) => SECRET_KEY_PATTERN.test(key));
}
