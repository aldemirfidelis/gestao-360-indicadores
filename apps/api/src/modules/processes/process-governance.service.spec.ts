import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProcessGovernanceService } from './process-governance.service';
import { ProcessLinksService } from './process-links.service';

const processId = '987efafd-314b-49d5-aa50-7f55af6ce970';
const artifactId = 'a87efafd-314b-49d5-aa50-7f55af6ce971';
const userId = 'b87efafd-314b-49d5-aa50-7f55af6ce972';
const me: any = { sub: userId, companyId: 'company-a', role: 'ANALYST', name: 'Analista', email: 'analista@example.test' };
const subject = { id: userId, name: 'Analista', active: true, defaultNodeId: 'area-a', jobTitle: 'Analista' };
function setup(overrides: any = {}) {
  const artifact = { id: artifactId, processId, kind: 'SIPOC', name: 'SIPOC', state: 'DRAFT', revision: 2, version: 1, content: { suppliers: [], inputs: [], steps: [], outputs: [], customers: [] }, activities: [], raciRows: [], ...overrides };
  const prisma: any = {
    processArtifact: { findFirst: vi.fn().mockResolvedValue(artifact), findUniqueOrThrow: vi.fn().mockResolvedValue(artifact), update: vi.fn() },
    processArtifactVersion: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    $queryRaw: vi.fn().mockResolvedValue([{ id: artifactId }]),
    processActivity: { findFirst: vi.fn().mockResolvedValue(null) },
    processRaciRow: { findFirst: vi.fn() },
  };
  prisma.$transaction = vi.fn((callback) => callback(prisma));
  const processes: any = { getById: vi.fn().mockResolvedValue({ id: processId, name: 'Implantação', status: 'ACTIVE', areaId: 'area-a', ownerUserId: userId }) };
  const access: any = { assertCanWrite: vi.fn(), listAreaFilter: vi.fn().mockResolvedValue(['area-a']) };
  const links: any = { context: vi.fn().mockResolvedValue({ admin: false, permissions: new Set(['processes:manage']) }), subject: vi.fn().mockResolvedValue(subject) };
  return { service: new ProcessGovernanceService(prisma, processes, links, access), prisma, processes, access, links, artifact };
}

describe('governança de processos: autorização e concorrência', () => {
  it('carrega artefatos por empresa e não revela IDs de outra empresa', async () => {
    const { service, prisma } = setup();
    prisma.processArtifact.findFirst.mockResolvedValue(null);
    await expect(service.getArtifact(me, artifactId)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.processArtifact.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: artifactId, process: { companyId: me.companyId, deletedAt: null } } }));
  });
  it('não salva quando a revisão foi alterada por outra pessoa', async () => {
    const { service, prisma } = setup();
    await expect(service.saveArtifact(me, artifactId, { revision: 1, changeNote: 'Mudança' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.processArtifact.update).not.toHaveBeenCalled();
    expect(prisma.processArtifactVersion.create).not.toHaveBeenCalled();
  });
  it.each(['APPROVED', 'PUBLISHED', 'ARCHIVED', 'IN_REVIEW'])('preserva conteúdo protegido em %s', async (state) => {
    const { service, prisma } = setup({ state });
    await expect(service.saveArtifact(me, artifactId, { revision: 2, name: 'Tentativa', changeNote: 'Mudança' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.processArtifact.update).not.toHaveBeenCalled();
  });
  it('exige permissão específica para aprovar e publicar', async () => {
    const { service, links, prisma } = setup();
    links.context.mockResolvedValue({ admin: false, permissions: new Set(['processes:update']) });
    await expect(service.transition(me, artifactId, { revision: 2, action: 'APPROVE', changeNote: 'Aprovar' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.transition(me, artifactId, { revision: 2, action: 'PUBLISH', changeNote: 'Publicar' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('não permite pular revisão e aprovação', async () => {
    const { service, prisma } = setup();
    await expect(service.transition(me, artifactId, { revision: 2, action: 'PUBLISH', changeNote: 'Publicar' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.processArtifact.update).not.toHaveBeenCalled();
  });
  it('identifica movimentação de área/cargo e não transfere a responsabilidade', async () => {
    const { service } = setup();
    const result = await service.validateArtifact(me, { kind: 'RACI', raciRows: [{ id: userId, name: 'Testar', assignments: ['R', 'A'].map((role) => ({ role, subjectKey: `USER:${userId}`, userId, subjectSnapshot: { ...subject, defaultNodeId: 'area-anterior' } })) }] });
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('alteração organizacional')]));
  });
  it('bloqueia envio de SIPOC incompleto', async () => {
    const { service, prisma } = setup();
    await expect(service.transition(me, artifactId, { revision: 2, action: 'SUBMIT', changeNote: 'Revisar' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.processArtifact.update).not.toHaveBeenCalled();
  });
});

describe('vínculos: produto, permissões e escopo', () => {
  function linksService() {
    const prisma: any = { project: { findMany: vi.fn().mockResolvedValue([]) } };
    const access: any = { listAreaFilter: vi.fn().mockResolvedValue(['area-a']) };
    const service = new ProcessLinksService(prisma, access, {} as any, {} as any);
    const context: any = { user: me, admin: false, modules: new Set(['projects']), permissions: new Set(['projects:view']) };
    return { service, prisma, context };
  }
  it('restringe o destino por empresa e inclui projetos gerais nas áreas permitidas', async () => {
    const { service, prisma, context } = linksService();
    await service.query(context, 'PROJECT', artifactId);
    const args = prisma.project.findMany.mock.calls[0][0];
    expect(args.where.companyId).toBe(me.companyId);
    expect(args.where.AND[0].OR).toContainEqual({ indicator: null });
    expect(args.select.name).toBe(true);
  });
  it('RACI/processos não concedem leitura de projetos', async () => {
    const { service, context, prisma } = linksService();
    context.permissions = new Set(['processes:manage']);
    await expect(service.query(context, 'PROJECT', artifactId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.project.findMany).not.toHaveBeenCalled();
  });
  it('rejeita módulos suspensos mesmo para super admin e tipos arbitrários', async () => {
    const { service, context } = linksService();
    expect(service.canRead({ ...context, admin: true }, 'DOCUMENT')).toBe(false);
    await expect(service.query(context, 'constructor' as any)).rejects.toBeInstanceOf(BadRequestException);
  });
});
