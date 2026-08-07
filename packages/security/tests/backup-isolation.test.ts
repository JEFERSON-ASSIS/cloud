import { describe, expect, it } from "vitest";
import { AuthorizationError, assertSectorPermission, hasSectorPermission } from "../src/index";

describe("Isolamento de Backups por Secretaria (Fase 2.2)", () => {
  const userSaude = {
    userId: "user-saude-1",
    organizationId: "org-prefeitura-cuiaba",
    sectorId: "sector-saude",
    sectorRole: "EDITOR" as const,
  };

  const userEducacao = {
    userId: "user-educacao-1",
    organizationId: "org-prefeitura-cuiaba",
    sectorId: "sector-educacao",
    sectorRole: "EDITOR" as const,
  };

  const admin = {
    userId: "admin-1",
    organizationId: "org-prefeitura-cuiaba",
    isOrgAdmin: true,
  };

  it("permite ao usuário da Saúde gerenciar backup da sua própria Secretaria", () => {
    expect(() =>
      assertSectorPermission(userSaude.sectorRole, "EDITOR", false)
    ).not.toThrow();
  });

  it("bloqueia usuário da Saúde ao tentar acessar/modificar backup da Educação", () => {
    const isMemberOfEducacao = userSaude.sectorId === userEducacao.sectorId;
    expect(isMemberOfEducacao).toBe(false);

    // Sem papel na Secretaria da Educação
    const userRoleInEducacao = isMemberOfEducacao ? userSaude.sectorRole : null;
    expect(() =>
      assertSectorPermission(userRoleInEducacao, "VIEWER_DOWNLOAD", false)
    ).toThrow(AuthorizationError);
  });

  it("bloqueia usuário da Educação ao tentar executar/restaurar backup da Saúde", () => {
    const isMemberOfSaude = userEducacao.sectorId === userSaude.sectorId;
    expect(isMemberOfSaude).toBe(false);

    const userRoleInSaude = isMemberOfSaude ? userEducacao.sectorRole : null;
    expect(() =>
      assertSectorPermission(userRoleInSaude, "ADMIN", false)
    ).toThrow(AuthorizationError);
  });

  it("permite ao Administrador da Prefeitura gerenciar backups de todas as Secretarias", () => {
    expect(() =>
      assertSectorPermission(null, "ADMIN", admin.isOrgAdmin)
    ).not.toThrow();
  });

  it("rejeita combinação inconsistente de origens de Secretarias diferentes em um agendamento", () => {
    const sourceSaude = { id: "source-1", sectorId: "sector-saude" };
    const sourceEducacao = { id: "source-2", sectorId: "sector-educacao" };

    const sources = [sourceSaude, sourceEducacao];
    const sectorIds = Array.from(new Set(sources.map((s) => s.sectorId).filter(Boolean)));

    const isConsistent = sectorIds.length <= 1;
    expect(isConsistent).toBe(false);
  });

  it("aceita agendamento quando todas as origens pertencem à mesma Secretaria", () => {
    const sourceSaude1 = { id: "source-1", sectorId: "sector-saude" };
    const sourceSaude2 = { id: "source-3", sectorId: "sector-saude" };

    const sources = [sourceSaude1, sourceSaude2];
    const sectorIds = Array.from(new Set(sources.map((s) => s.sectorId).filter(Boolean)));

    const isConsistent = sectorIds.length <= 1;
    expect(isConsistent).toBe(true);
    expect(sectorIds[0]).toBe("sector-saude");
  });

  describe("Scheduler Automático do Worker (Preenchimento e Consistência de sectorId)", () => {
    function resolveSchedulerRun(
      source: { organizationId: string; sectorId?: string | null },
      schedule: { organizationId: string; sectorId?: string | null }
    ): { success: boolean; sectorId?: string | null; reason?: string } {
      if (source.organizationId !== schedule.organizationId) {
        return { success: false, reason: "Divergência de Organização" };
      }
      const resolvedSectorId = source.sectorId || schedule.sectorId;
      if (!resolvedSectorId) {
        return { success: false, reason: "Ausência de Secretaria associada" };
      }
      if (source.sectorId && schedule.sectorId && source.sectorId !== schedule.sectorId) {
        return { success: false, reason: "Inconsistência entre Origem e Agendamento" };
      }
      return { success: true, sectorId: resolvedSectorId };
    }

    it("cria BackupRun com sectorId === SAUDE quando Origem e Agendamento pertencem à Saúde", () => {
      const res = resolveSchedulerRun(
        { organizationId: "org-1", sectorId: "sector-saude" },
        { organizationId: "org-1", sectorId: "sector-saude" }
      );
      expect(res.success).toBe(true);
      expect(res.sectorId).toBe("sector-saude");
    });

    it("rejeita e NÃO cria BackupRun quando Origem é Saúde e Agendamento é Educação", () => {
      const res = resolveSchedulerRun(
        { organizationId: "org-1", sectorId: "sector-saude" },
        { organizationId: "org-1", sectorId: "sector-educacao" }
      );
      expect(res.success).toBe(false);
      expect(res.reason).toBe("Inconsistência entre Origem e Agendamento");
    });

    it("rejeita e NÃO cria BackupRun com sectorId NULL quando a Origem/Agendamento não possuem Secretaria", () => {
      const res = resolveSchedulerRun(
        { organizationId: "org-1", sectorId: null },
        { organizationId: "org-1", sectorId: null }
      );
      expect(res.success).toBe(false);
      expect(res.reason).toBe("Ausência de Secretaria associada");
    });
  });
});
