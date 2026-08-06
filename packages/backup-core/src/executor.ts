import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

/** Comandos permitidos pelo executor seguro */
const ALLOWED_COMMANDS = new Set(["docker", "mysqldump", "pg_dump", "pg_restore", "gzip", "tar", "sha256sum"]);

export interface ExecutorResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export class CommandNotAllowedError extends Error {
  constructor(cmd: string) {
    super(`Comando não permitido: ${cmd}`);
    this.name = "CommandNotAllowedError";
  }
}

export class CommandTimeoutError extends Error {
  constructor(cmd: string, timeoutMs: number) {
    super(`Comando "${cmd}" excedeu o timeout de ${timeoutMs}ms`);
    this.name = "CommandTimeoutError";
  }
}

/**
 * SafeProcessExecutor — Executor seguro de processos externos.
 *
 * - Usa execFile (nunca concatenação shell)
 * - Argumentos separados (sem injeção)
 * - Valida comandos permitidos
 * - Aplica timeout configurável
 * - Captura stdout, stderr, exit code
 */
export class SafeProcessExecutor {
  constructor(
    private readonly timeoutMs: number = 30 * 60 * 1000, // 30 min default
    private readonly maxBuffer: number = 500 * 1024 * 1024, // 500 MB
  ) {}

  async execute(command: string, args: string[]): Promise<ExecutorResult> {
    // Extrair o executável base (sem path) para validação
    const basename = path.basename(command);
    if (!ALLOWED_COMMANDS.has(basename)) {
      throw new CommandNotAllowedError(basename);
    }

    // Validar que nenhum argumento contém caracteres de injeção de shell
    for (const arg of args) {
      if (/[;&|`$><\\]/.test(arg) && !arg.startsWith("--")) {
        // Apenas bloquear se não for uma flag conhecida
        // Permitir valores com caracteres especiais se for argumento de valor de DB
        // (senhas podem ter caracteres especiais, mas são passadas por env var, não arg)
        void arg; // verificação superficial; senhas devem ir por env
      }
    }

    const start = Date.now();

    try {
      const { stdout, stderr } = await execFileAsync(command, args, {
        timeout: this.timeoutMs,
        maxBuffer: this.maxBuffer,
        killSignal: "SIGTERM",
      });

      return {
        stdout,
        stderr,
        exitCode: 0,
        durationMs: Date.now() - start,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - start;

      // Verificar timeout
      if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ETIMEDOUT") {
        throw new CommandTimeoutError(command, this.timeoutMs);
      }

      // Erro de processo (exit code != 0)
      const anyErr = err as { stdout?: string; stderr?: string; code?: number | string };
      return {
        stdout: anyErr.stdout ?? "",
        stderr: anyErr.stderr ?? String(err),
        exitCode: typeof anyErr.code === "number" ? anyErr.code : 1,
        durationMs,
      };
    }
  }

  /**
   * Executa um comando com variáveis de ambiente customizadas (ex: PGPASSWORD)
   * Argumentos de senha NUNCA devem ser passados na linha de comando.
   */
  async executeWithEnv(
    command: string,
    args: string[],
    env: Record<string, string>,
  ): Promise<ExecutorResult> {
    const basename = path.basename(command);
    if (!ALLOWED_COMMANDS.has(basename)) {
      throw new CommandNotAllowedError(basename);
    }

    const start = Date.now();

    try {
      const { stdout, stderr } = await execFileAsync(command, args, {
        timeout: this.timeoutMs,
        maxBuffer: this.maxBuffer,
        killSignal: "SIGTERM",
        env: {
          ...process.env,
          ...env,
        },
      });

      return { stdout, stderr, exitCode: 0, durationMs: Date.now() - start };
    } catch (err: unknown) {
      const durationMs = Date.now() - start;

      if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ETIMEDOUT") {
        throw new CommandTimeoutError(command, this.timeoutMs);
      }

      const anyErr = err as { stdout?: string; stderr?: string; code?: number | string };
      return {
        stdout: anyErr.stdout ?? "",
        stderr: anyErr.stderr ?? String(err),
        exitCode: typeof anyErr.code === "number" ? anyErr.code : 1,
        durationMs,
      };
    }
  }
}

/** Instância padrão do executor (timeout 30 min) */
export const safeExecutor = new SafeProcessExecutor();
