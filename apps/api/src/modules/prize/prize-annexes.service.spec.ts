import { describe, it, expect, beforeEach } from 'vitest';
import { PrizeAnnexesService } from './prize-annexes.service';

/**
 * Fake Prisma minimo, em memoria, cobrindo as operacoes usadas pela governanca
 * de anexos (workflow + regra de versao unica vigente). Sem banco real.
 */
function makeFakePrisma() {
  const annexes: any[] = [
    { id: 'A1', companyId: 'C1', programId: 'P1', code: 'ANX-001', orgNodeId: null, positionRef: null, costCenterRef: null, deletedAt: null, currentVersionId: null },
  ];
  const versions: any[] = [
    { id: 'V1', annexId: 'A1', version: 1, status: 'EFFECTIVE', effectiveFrom: null, effectiveTo: null, supersededAt: null, supersededByVersionId: null, approvedAt: null },
    { id: 'V2', annexId: 'A1', version: 2, status: 'DRAFT', effectiveFrom: null, effectiveTo: null, supersededAt: null, supersededByVersionId: null, approvedAt: null },
    { id: 'V3', annexId: 'A1', version: 3, status: 'DRAFT', effectiveFrom: null, effectiveTo: null, supersededAt: null, supersededByVersionId: null, approvedAt: null },
  ];
  const approvals: any[] = [];

  const prizeAnnexVersion = {
    findFirst: async ({ where }: any) => {
      if (where.id && where.annex) {
        const v = versions.find((x) => x.id === where.id);
        if (!v) return null;
        const annex = annexes.find((a) => a.id === v.annexId && a.companyId === where.annex.companyId);
        if (!annex) return null;
        return { ...v, annex };
      }
      if (where.annexId && where.status) {
        return versions.find((x) => x.annexId === where.annexId && x.status === where.status) ?? null;
      }
      return null;
    },
    update: async ({ where, data }: any) => {
      const v = versions.find((x) => x.id === where.id);
      Object.assign(v, data);
      return { ...v };
    },
  };
  const prizeAnnex = {
    findMany: async ({ where }: any) => {
      return annexes
        .filter((a) => a.companyId === where.companyId && a.id !== where.id?.not && a.programId === where.programId)
        .map((a) => ({ ...a, versions: versions.filter((v) => v.annexId === a.id && v.status === 'EFFECTIVE') }));
    },
    update: async ({ where, data }: any) => {
      const a = annexes.find((x) => x.id === where.id);
      Object.assign(a, data);
      return { ...a };
    },
  };
  const prizeAnnexApproval = {
    create: async ({ data }: any) => {
      const row = { id: `AP${approvals.length + 1}`, ...data };
      approvals.push(row);
      return row;
    },
    updateMany: async ({ where, data }: any) => {
      let n = 0;
      for (const ap of approvals) {
        if (ap.annexVersionId === where.annexVersionId && ap.status === where.status) {
          Object.assign(ap, data);
          n++;
        }
      }
      return { count: n };
    },
  };

  const prisma: any = {
    prizeAnnexVersion,
    prizeAnnex,
    prizeAnnexApproval,
    $transaction: async (cb: any) => cb(prisma),
  };
  return { prisma, versions, annexes, approvals };
}

const me: any = { companyId: 'C1', sub: 'U1', email: 'u@x.com' };
const auditStub: any = { log: async () => undefined };

describe('PrizeAnnexesService — governança de anexos', () => {
  let env: ReturnType<typeof makeFakePrisma>;
  let service: PrizeAnnexesService;

  beforeEach(() => {
    env = makeFakePrisma();
    service = new PrizeAnnexesService(env.prisma, auditStub);
  });

  it('publicar versão aprovada substitui a versão vigente anterior (versão única vigente)', async () => {
    // V2 aprovada
    env.versions.find((v) => v.id === 'V2')!.status = 'APPROVED';
    await service.publish(me, 'V2');

    const effective = env.versions.filter((v) => v.status === 'EFFECTIVE');
    expect(effective).toHaveLength(1);
    expect(effective[0].id).toBe('V2');
    expect(env.versions.find((v) => v.id === 'V1')!.status).toBe('SUPERSEDED');
    expect(env.versions.find((v) => v.id === 'V1')!.supersededByVersionId).toBe('V2');
    expect(env.annexes.find((a) => a.id === 'A1')!.currentVersionId).toBe('V2');
  });

  it('não publica versão que não está APROVADA', async () => {
    await expect(service.publish(me, 'V3')).rejects.toThrow();
  });

  it('não permite editar uma versão vigente (cria nova versão para alterar)', async () => {
    await expect(service.updateVersion(me, 'V1', { salaryPercent: 10 })).rejects.toThrow();
  });

  it('fluxo completo: submit → enviar p/ aprovação → aprovar → publicar', async () => {
    await service.updateVersion(me, 'V2', { salaryPercent: 15, changeReason: 'ajuste meta' });
    expect(env.versions.find((v) => v.id === 'V2')!.status).toBe('IN_ELABORATION');

    await service.submit(me, 'V2');
    expect(env.versions.find((v) => v.id === 'V2')!.status).toBe('IN_VALIDATION');

    await service.sendToApproval(me, 'V2', null, 'GESTOR');
    expect(env.versions.find((v) => v.id === 'V2')!.status).toBe('IN_APPROVAL');
    expect(env.approvals).toHaveLength(1);

    await service.decide(me, 'V2', 'APPROVE');
    expect(env.versions.find((v) => v.id === 'V2')!.status).toBe('APPROVED');
    expect(env.approvals[0].status).toBe('APPROVED');

    await service.publish(me, 'V2');
    expect(env.versions.find((v) => v.id === 'V2')!.status).toBe('EFFECTIVE');
    expect(env.versions.find((v) => v.id === 'V1')!.status).toBe('SUPERSEDED');
  });

  it('devolver para ajuste exige comentário e volta para IN_ELABORATION', async () => {
    env.versions.find((v) => v.id === 'V2')!.status = 'IN_APPROVAL';
    await expect(service.decide(me, 'V2', 'RETURN')).rejects.toThrow();
    await service.decide(me, 'V2', 'RETURN', 'faltou evidência');
    expect(env.versions.find((v) => v.id === 'V2')!.status).toBe('IN_ELABORATION');
  });
});
