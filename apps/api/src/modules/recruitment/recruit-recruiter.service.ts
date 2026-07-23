import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { AuthPayload } from '../auth/auth.types';

const MODULE = 'recruitment';

// Palavras que identificam a área de Recursos Humanos (nome do OrgNode). Serve
// só para SUGERIR/ordenar candidatos a recrutador — não bloqueia o cadastro,
// porque cada empresa nomeia a área de gente de um jeito.
const RH_HINTS = ['recursos humanos', 'rh', 'gente', 'pessoas', 'pessoal', 'talento', 'dho', 'dp', 'capital humano'];

function looksLikeRh(name: string | null | undefined): boolean {
  const n = (name ?? '').toLowerCase();
  return RH_HINTS.some((hint) => n === hint || n.includes(hint));
}

/**
 * Cadastro de recrutadores (quem CONDUZ as seleções). Vêm da área de Recursos
 * Humanos, mas o cadastro aceita qualquer usuário ativo (a empresa nomeia a
 * área de gente de formas diferentes). Cada recrutador tem um líder opcional
 * que acompanha as vagas conduzidas por ele.
 */
@Injectable()
export class RecruitRecruiterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
  ) {}

  /** Recrutadores cadastrados, com nome do recrutador, do líder e a área. */
  async list(me: AuthPayload) {
    const recruiters = await this.prisma.recruitRecruiter.findMany({
      where: { companyId: me.companyId },
      orderBy: { createdAt: 'desc' },
    });
    const userIds = [...new Set(recruiters.flatMap((r) => [r.userId, r.leadUserId]).filter((x): x is string => Boolean(x)))];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds }, companyId: me.companyId },
          select: { id: true, name: true, email: true, defaultNode: { select: { name: true } } },
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return recruiters.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: byId.get(r.userId)?.name ?? null,
      areaName: byId.get(r.userId)?.defaultNode?.name ?? null,
      leadUserId: r.leadUserId,
      leadUserName: r.leadUserId ? byId.get(r.leadUserId)?.name ?? null : null,
      active: r.active,
      createdAt: r.createdAt,
    }));
  }

  /** Só os recrutadores ativos (para o encaminhamento escolher quem conduz). */
  async listActive(me: AuthPayload) {
    return (await this.list(me)).filter((r) => r.active);
  }

  /**
   * Usuários elegíveis a virar recrutador: todos os ativos da empresa, com a
   * área, marcando os de RH e ordenando-os primeiro. Não filtra fora quem não é
   * de RH — só sugere.
   */
  async candidates(me: AuthPayload) {
    const [users, existing] = await Promise.all([
      this.prisma.user.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true, role: { not: 'SUPER_ADMIN' } },
        select: { id: true, name: true, email: true, defaultNode: { select: { name: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.recruitRecruiter.findMany({ where: { companyId: me.companyId }, select: { userId: true } }),
    ]);
    const alreadyRecruiter = new Set(existing.map((r) => r.userId));
    return users
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        areaName: u.defaultNode?.name ?? null,
        fromRh: looksLikeRh(u.defaultNode?.name),
        alreadyRecruiter: alreadyRecruiter.has(u.id),
      }))
      .sort((a, b) => Number(b.fromRh) - Number(a.fromRh) || a.name.localeCompare(b.name, 'pt-BR'));
  }

  async create(me: AuthPayload, body: any = {}) {
    const userId = text(body?.userId);
    if (!userId) throw new BadRequestException('Selecione o usuário que será o recrutador.');
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId: me.companyId, deletedAt: null, active: true },
      select: { id: true, name: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado ou inativo.');
    const leadUserId = await this.resolveLead(me, body?.leadUserId, userId);

    const existing = await this.prisma.recruitRecruiter.findUnique({
      where: { companyId_userId: { companyId: me.companyId, userId } },
    });
    if (existing) {
      // Idempotente: recadastrar um recrutador só o reativa/atualiza o líder.
      const updated = await this.prisma.recruitRecruiter.update({
        where: { id: existing.id },
        data: { active: true, leadUserId },
      });
      await this.audit.record(me, { module: MODULE, entity: 'RecruitRecruiter', entityId: updated.id, action: 'UPDATE', message: `Recrutador "${user.name}" reativado`, after: { userId, leadUserId } });
      return this.get(me, updated.id);
    }
    const created = await this.prisma.recruitRecruiter.create({
      data: { companyId: me.companyId, userId, leadUserId, createdById: me.sub },
    });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitRecruiter', entityId: created.id, action: 'CREATE', message: `Recrutador "${user.name}" cadastrado`, after: { userId, leadUserId } });
    return this.get(me, created.id);
  }

  async update(me: AuthPayload, id: string, body: any = {}) {
    const rec = await this.recruiterOf(me.companyId, id);
    const data: { active?: boolean; leadUserId?: string | null } = {};
    if (body?.active !== undefined) data.active = Boolean(body.active);
    if (body?.leadUserId !== undefined) data.leadUserId = await this.resolveLead(me, body.leadUserId, rec.userId);
    if (!Object.keys(data).length) throw new BadRequestException('Nada para atualizar.');
    const updated = await this.prisma.recruitRecruiter.update({ where: { id }, data });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitRecruiter', entityId: id, action: 'UPDATE', message: 'Recrutador atualizado', after: data });
    return this.get(me, updated.id);
  }

  async remove(me: AuthPayload, id: string) {
    await this.recruiterOf(me.companyId, id);
    await this.prisma.recruitRecruiter.delete({ where: { id } });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitRecruiter', entityId: id, action: 'DELETE', message: 'Recrutador removido do cadastro' });
    return { removed: true };
  }

  /** Líder registrado de um recrutador (para autopreencher no encaminhamento). */
  async leadOf(companyId: string, recruiterUserId: string): Promise<string | null> {
    const rec = await this.prisma.recruitRecruiter.findUnique({
      where: { companyId_userId: { companyId, userId: recruiterUserId } },
      select: { active: true, leadUserId: true },
    });
    return rec?.active ? rec.leadUserId : null;
  }

  /** Confere se um usuário é recrutador ATIVO cadastrado. */
  async isActiveRecruiter(companyId: string, userId: string): Promise<boolean> {
    const rec = await this.prisma.recruitRecruiter.findUnique({
      where: { companyId_userId: { companyId, userId } },
      select: { active: true },
    });
    return Boolean(rec?.active);
  }

  private async get(me: AuthPayload, id: string) {
    return (await this.list(me)).find((r) => r.id === id) ?? null;
  }

  private async recruiterOf(companyId: string, id: string) {
    const rec = await this.prisma.recruitRecruiter.findFirst({ where: { id, companyId } });
    if (!rec) throw new NotFoundException('Recrutador não encontrado.');
    return rec;
  }

  private async resolveLead(me: AuthPayload, leadUserIdRaw: unknown, recruiterUserId: string): Promise<string | null> {
    const leadUserId = text(leadUserIdRaw);
    if (!leadUserId) return null;
    if (leadUserId === recruiterUserId) throw new BadRequestException('O líder não pode ser o próprio recrutador.');
    const lead = await this.prisma.user.findFirst({
      where: { id: leadUserId, companyId: me.companyId, deletedAt: null, active: true },
      select: { id: true },
    });
    if (!lead) throw new NotFoundException('Líder informado não encontrado ou inativo.');
    return leadUserId;
  }
}

function text(value: unknown): string | null {
  const t = String(value ?? '').trim();
  return t || null;
}
