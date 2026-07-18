import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrizeAnnexStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { PrizeAuditService } from './prize-audit.service';
import { resolveResponsibleChain } from '../../common/org-hierarchy';

export interface CreateAnnexDto {
  programId?: string;
  code?: string;
  name?: string;
  orgNodeId?: string | null;
  positionRef?: string | null;
  costCenterRef?: string | null;
  notes?: string | null;
}

export interface VersionDto {
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  salaryPercent?: number | null;
  gainPotential?: number | null;
  gainChance?: number | null;
  formula?: unknown;
  rules?: unknown;
  criteria?: unknown;
  changeReason?: string | null;
}

const EDITABLE: PrizeAnnexStatus[] = ['DRAFT', 'IN_ELABORATION'];

@Injectable()
export class PrizeAnnexesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PrizeAuditService,
  ) {}

  async list(companyId: string, query: { programId?: string; q?: string } = {}) {
    const annexes = await this.prisma.prizeAnnex.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(query.programId ? { programId: query.programId } : {}),
        ...(query.q
          ? { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { code: { contains: query.q, mode: 'insensitive' } }] }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        program: { select: { id: true, code: true, name: true } },
        versions: { orderBy: { version: 'desc' }, select: { id: true, version: true, status: true, effectiveFrom: true, effectiveTo: true } },
      },
    });
    return annexes.map((a) => {
      const effective = a.versions.find((v) => v.status === 'EFFECTIVE') ?? null;
      const latest = a.versions[0] ?? null;
      return { ...a, effectiveVersion: effective, latestVersion: latest };
    });
  }

  async get(companyId: string, id: string) {
    const annex = await this.prisma.prizeAnnex.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        program: { select: { id: true, code: true, name: true } },
        versions: {
          orderBy: { version: 'desc' },
          include: {
            approvals: { orderBy: { stepOrder: 'asc' } },
            _count: { select: { indicators: true } },
          },
        },
      },
    });
    if (!annex) throw new NotFoundException('Anexo não encontrado');
    return annex;
  }

  async create(me: AuthPayload, dto: CreateAnnexDto) {
    if (!dto.programId) throw new BadRequestException('Programa é obrigatório');
    if (!dto.name?.trim()) throw new BadRequestException('Nome do anexo é obrigatório');
    const program = await this.prisma.prizeProgram.findFirst({ where: { id: dto.programId, companyId: me.companyId, deletedAt: null } });
    if (!program) throw new NotFoundException('Programa de prêmio não encontrado');

    const code = (dto.code ?? '').trim() || (await this.nextCode(me.companyId));
    const dup = await this.prisma.prizeAnnex.findFirst({ where: { companyId: me.companyId, code, deletedAt: null } });
    if (dup) throw new ConflictException(`Já existe um anexo com o código ${code}`);

    const annex = await this.prisma.prizeAnnex.create({
      data: {
        companyId: me.companyId,
        programId: dto.programId,
        code,
        name: dto.name.trim(),
        orgNodeId: dto.orgNodeId ?? null,
        positionRef: dto.positionRef ?? null,
        costCenterRef: dto.costCenterRef ?? null,
        notes: dto.notes ?? null,
        createdById: me.sub,
        versions: { create: { version: 1, status: 'DRAFT', createdById: me.sub } },
      },
      include: { versions: true },
    });
    await this.audit.log(me, { action: 'CREATE', entityType: 'ANNEX', entityId: annex.id, after: annex });
    return annex;
  }

  async createVersion(me: AuthPayload, annexId: string, copyFromVersionId?: string) {
    const annex = await this.get(me.companyId, annexId);
    const last = annex.versions[0];
    let base: VersionDto = {};
    if (copyFromVersionId) {
      const src = annex.versions.find((v) => v.id === copyFromVersionId);
      if (!src) throw new NotFoundException('Versão de origem não encontrada');
      base = {
        salaryPercent: src.salaryPercent ? Number(src.salaryPercent) : null,
        gainPotential: src.gainPotential ? Number(src.gainPotential) : null,
        gainChance: src.gainChance ? Number(src.gainChance) : null,
        formula: src.formula,
        rules: src.rules,
        criteria: src.criteria,
      };
    }
    const version = await this.prisma.prizeAnnexVersion.create({
      data: {
        annexId,
        version: (last?.version ?? 0) + 1,
        status: 'DRAFT',
        salaryPercent: base.salaryPercent ?? undefined,
        gainPotential: base.gainPotential ?? undefined,
        gainChance: base.gainChance ?? undefined,
        formula: (base.formula as Prisma.InputJsonValue) ?? undefined,
        rules: (base.rules as Prisma.InputJsonValue) ?? undefined,
        criteria: (base.criteria as Prisma.InputJsonValue) ?? undefined,
        createdById: me.sub,
      },
    });
    await this.audit.log(me, { action: 'NEW_VERSION', entityType: 'ANNEX_VERSION', entityId: version.id, after: version });
    return version;
  }

  private async getVersion(companyId: string, versionId: string) {
    const version = await this.prisma.prizeAnnexVersion.findFirst({
      where: { id: versionId, annex: { companyId } },
      include: { annex: true },
    });
    if (!version) throw new NotFoundException('Versão do anexo não encontrada');
    return version;
  }

  async updateVersion(me: AuthPayload, versionId: string, dto: VersionDto) {
    const version = await this.getVersion(me.companyId, versionId);
    if (!EDITABLE.includes(version.status)) {
      throw new ForbiddenException('Esta versão não é editável. Crie uma nova versão para alterar.');
    }
    const updated = await this.prisma.prizeAnnexVersion.update({
      where: { id: versionId },
      data: {
        effectiveFrom: dto.effectiveFrom !== undefined ? (dto.effectiveFrom ? new Date(dto.effectiveFrom) : null) : undefined,
        effectiveTo: dto.effectiveTo !== undefined ? (dto.effectiveTo ? new Date(dto.effectiveTo) : null) : undefined,
        salaryPercent: dto.salaryPercent ?? undefined,
        gainPotential: dto.gainPotential ?? undefined,
        gainChance: dto.gainChance ?? undefined,
        formula: (dto.formula as Prisma.InputJsonValue) ?? undefined,
        rules: (dto.rules as Prisma.InputJsonValue) ?? undefined,
        criteria: (dto.criteria as Prisma.InputJsonValue) ?? undefined,
        changeReason: dto.changeReason ?? undefined,
        status: version.status === 'DRAFT' ? 'IN_ELABORATION' : undefined,
      },
    });
    await this.audit.log(me, { action: 'UPDATE', entityType: 'ANNEX_VERSION', entityId: versionId, before: version, after: updated });
    return updated;
  }

  /** DRAFT/IN_ELABORATION -> IN_VALIDATION (envia para validacao).
   * Quando informados, registra os destinatarios (gestores da area) como
   * etapas de aprovacao pendentes — assim o anexo "vai" para pessoas
   * especificas (gestor imediato ... superintendente), nao para um limbo. */
  async submit(me: AuthPayload, versionId: string, approverUserIds: string[] = []) {
    const version = await this.getVersion(me.companyId, versionId);
    if (!EDITABLE.includes(version.status)) throw new ConflictException('Versão já está em fluxo de aprovação ou vigente');
    const recipients = Array.from(new Set(approverUserIds.filter(Boolean)));
    const updated = await this.prisma.$transaction(async (tx) => {
      if (recipients.length) {
        await tx.prizeAnnexApproval.deleteMany({ where: { annexVersionId: versionId, status: 'PENDING' } });
        await tx.prizeAnnexApproval.createMany({
          data: recipients.map((userId, idx) => ({ annexVersionId: versionId, stepOrder: idx + 1, approverUserId: userId, status: 'PENDING' as const })),
        });
      }
      return tx.prizeAnnexVersion.update({ where: { id: versionId }, data: { status: 'IN_VALIDATION', submittedAt: new Date() } });
    });
    await this.audit.log(me, { action: 'SUBMIT', entityType: 'ANNEX_VERSION', entityId: versionId, before: { status: version.status }, after: { status: 'IN_VALIDATION', recipients } });
    return updated;
  }

  /**
   * Cadeia de gestores aptos a validar/aprovar o anexo: parte da area do anexo
   * (orgNodeId) e das areas das combinacoes da versao mais recente, subindo a
   * hierarquia (OrgNode.parentId) e coletando o responsavel de cada nivel ate o
   * topo (superintendente / gestores maiores). Sem duplicados; ordenado do
   * gestor imediato ao mais alto.
   */
  async listApprovers(companyId: string, annexId: string) {
    const annex = await this.prisma.prizeAnnex.findFirst({ where: { id: annexId, companyId, deletedAt: null } });
    if (!annex) throw new NotFoundException('Anexo não encontrado');

    const groups = await this.prisma.prizeRuleGroup.findMany({
      where: { companyId, deletedAt: null, annexVersion: { annexId } },
      select: { areaRefs: true },
    });
    const areaNames = new Set<string>();
    for (const g of groups) for (const a of g.areaRefs) areaNames.add(a.trim().toLowerCase());

    const nodes = await this.prisma.orgNode.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, name: true, parentId: true, responsibleUserId: true },
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));

    // Nos de partida: a area do anexo + as areas das combinacoes (por nome).
    const seeds = new Set<string>();
    if (annex.orgNodeId && byId.has(annex.orgNodeId)) seeds.add(annex.orgNodeId);
    for (const n of nodes) if (areaNames.has(n.name.trim().toLowerCase())) seeds.add(n.id);

    // Sobe a cadeia coletando o nivel (distancia) mais curto de cada responsavel.
    const chain = resolveResponsibleChain(nodes, seeds);
    const levelByUser = new Map(chain.map((c) => [c.userId, { level: c.level, orgNodeName: c.orgNodeName }]));

    if (levelByUser.size === 0) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: Array.from(levelByUser.keys()) }, companyId, deletedAt: null, active: true },
      select: { id: true, name: true, email: true, role: true },
    });
    return users
      .map((u) => ({ userId: u.id, name: u.name, email: u.email, role: u.role, ...levelByUser.get(u.id)! }))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }

  /** IN_VALIDATION -> IN_APPROVAL, criando etapa de aprovacao pendente. */
  async sendToApproval(me: AuthPayload, versionId: string, approverUserId?: string | null, approverRole?: string | null) {
    const version = await this.getVersion(me.companyId, versionId);
    if (version.status !== 'IN_VALIDATION') throw new ConflictException('Versão precisa estar em validação');
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.prizeAnnexApproval.create({
        data: { annexVersionId: versionId, stepOrder: 1, approverUserId: approverUserId ?? null, approverRole: approverRole ?? null, status: 'PENDING' },
      });
      return tx.prizeAnnexVersion.update({ where: { id: versionId }, data: { status: 'IN_APPROVAL' } });
    });
    await this.audit.log(me, { action: 'SEND_APPROVAL', entityType: 'ANNEX_VERSION', entityId: versionId, after: { status: 'IN_APPROVAL' } });
    return updated;
  }

  /** Decisao da alcada: APPROVE | REJECT | RETURN. */
  async decide(me: AuthPayload, versionId: string, decision: 'APPROVE' | 'REJECT' | 'RETURN', comment?: string) {
    const version = await this.getVersion(me.companyId, versionId);
    if (version.status !== 'IN_APPROVAL' && version.status !== 'IN_VALIDATION') {
      throw new ConflictException('Versão não está em fluxo de aprovação');
    }
    const map = { APPROVE: 'APPROVED', REJECT: 'IN_ELABORATION', RETURN: 'IN_ELABORATION' } as const;
    const approvalStatus = { APPROVE: 'APPROVED', REJECT: 'REJECTED', RETURN: 'RETURNED' } as const;
    if ((decision === 'REJECT' || decision === 'RETURN') && !comment?.trim()) {
      throw new BadRequestException('Comentário é obrigatório ao reprovar ou devolver');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.prizeAnnexApproval.updateMany({
        where: { annexVersionId: versionId, status: 'PENDING' },
        data: { status: approvalStatus[decision], comment: comment ?? null, decidedById: me.sub, decidedAt: new Date() },
      });
      return tx.prizeAnnexVersion.update({
        where: { id: versionId },
        data: { status: map[decision], approvedAt: decision === 'APPROVE' ? new Date() : null },
      });
    });
    await this.audit.log(me, {
      action: decision,
      entityType: 'ANNEX_VERSION',
      entityId: versionId,
      before: { status: version.status },
      after: { status: updated.status },
      justification: comment ?? null,
    });
    return updated;
  }

  /**
   * Publica a versao (APPROVED -> EFFECTIVE). Regra central de governanca:
   * somente UMA versao pode ficar vigente por anexo. A versao vigente anterior
   * e marcada SUPERSEDED. Tambem valida sobreposicao de vigencia em anexos de
   * mesmo contexto (programa+area+cargo+centro de custo).
   */
  async publish(me: AuthPayload, versionId: string) {
    const version = await this.getVersion(me.companyId, versionId);
    if (version.status !== 'APPROVED') throw new ConflictException('Apenas versões APROVADAS podem entrar em vigência');

    await this.assertNoContextOverlap(me.companyId, version.annex, version.effectiveFrom, version.effectiveTo);

    const result = await this.prisma.$transaction(async (tx) => {
      const previousEffective = await tx.prizeAnnexVersion.findFirst({
        where: { annexId: version.annexId, status: 'EFFECTIVE' },
      });
      if (previousEffective && previousEffective.id !== versionId) {
        await tx.prizeAnnexVersion.update({
          where: { id: previousEffective.id },
          data: { status: 'SUPERSEDED', supersededAt: new Date(), supersededByVersionId: versionId, effectiveTo: previousEffective.effectiveTo ?? new Date() },
        });
      }
      const effective = await tx.prizeAnnexVersion.update({
        where: { id: versionId },
        data: { status: 'EFFECTIVE' },
      });
      await tx.prizeAnnex.update({ where: { id: version.annexId }, data: { currentVersionId: versionId } });
      return { effective, supersededId: previousEffective?.id ?? null };
    });
    await this.audit.log(me, {
      action: 'PUBLISH',
      entityType: 'ANNEX_VERSION',
      entityId: versionId,
      after: { status: 'EFFECTIVE', superseded: result.supersededId },
    });
    return result.effective;
  }

  async archive(me: AuthPayload, versionId: string) {
    const version = await this.getVersion(me.companyId, versionId);
    if (version.status === 'EFFECTIVE') throw new ConflictException('Não arquive uma versão vigente. Substitua-a por outra versão.');
    const updated = await this.prisma.prizeAnnexVersion.update({ where: { id: versionId }, data: { status: 'ARCHIVED' } });
    await this.audit.log(me, { action: 'ARCHIVE', entityType: 'ANNEX_VERSION', entityId: versionId, after: { status: 'ARCHIVED' } });
    return updated;
  }

  async compareVersions(companyId: string, versionAId: string, versionBId: string) {
    const [a, b] = await Promise.all([this.getVersion(companyId, versionAId), this.getVersion(companyId, versionBId)]);
    const fields = ['salaryPercent', 'gainPotential', 'gainChance', 'effectiveFrom', 'effectiveTo', 'status'] as const;
    const diff = fields.map((f) => ({ field: f, a: (a as any)[f], b: (b as any)[f], changed: String((a as any)[f]) !== String((b as any)[f]) }));
    return { a: { id: a.id, version: a.version }, b: { id: b.id, version: b.version }, diff };
  }

  // ---- helpers ----
  private async nextCode(companyId: string) {
    const count = await this.prisma.prizeAnnex.count({ where: { companyId } });
    return `ANX-${String(count + 1).padStart(3, '0')}`;
  }

  private async assertNoContextOverlap(
    companyId: string,
    annex: { id: string; programId: string; orgNodeId: string | null; positionRef: string | null; costCenterRef: string | null },
    from: Date | null,
    to: Date | null,
  ) {
    // Outros anexos de mesmo contexto com versao vigente cujas vigencias se sobreponham.
    const peers = await this.prisma.prizeAnnex.findMany({
      where: {
        companyId,
        deletedAt: null,
        id: { not: annex.id },
        programId: annex.programId,
        orgNodeId: annex.orgNodeId,
        positionRef: annex.positionRef,
        costCenterRef: annex.costCenterRef,
      },
      include: { versions: { where: { status: 'EFFECTIVE' } } },
    });
    const start = from ? from.getTime() : -Infinity;
    const end = to ? to.getTime() : Infinity;
    for (const peer of peers) {
      for (const v of peer.versions) {
        const pStart = v.effectiveFrom ? v.effectiveFrom.getTime() : -Infinity;
        const pEnd = v.effectiveTo ? v.effectiveTo.getTime() : Infinity;
        if (start <= pEnd && pStart <= end) {
          throw new ConflictException(`Sobreposição de vigência com o anexo ${peer.code} no mesmo contexto`);
        }
      }
    }
  }
}
