import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { AuthPayload } from '../auth/auth.types';

const MODULE = 'recruitment';
const CLOSED_STATUSES = ['REJECTED', 'WITHDRAWN', 'DISQUALIFIED'];
const MAX_TAGS = 20;

/**
 * Banco de talentos: busca candidatos que já se candidataram a alguma vaga desta
 * empresa (o candidato é uma conta GLOBAL do portal — o vínculo que autoriza a
 * empresa a vê-lo/taguear é a candidatura, `RecruitApplication.companyId`, nunca
 * o `RecruitCandidate` diretamente). Ativa o `vacancyType: BANCO_TALENTOS` e o
 * `allowsFormerEmployees`/perfil reutilizável que já existiam no schema mas eram
 * dados mortos — nenhuma tela os expunha.
 */
@Injectable()
export class RecruitTalentPoolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
  ) {}

  async search(me: AuthPayload, filters: { q?: string; tag?: string; onlyAvailable?: boolean } = {}) {
    const linkedIds = await this.linkedCandidateIds(me.companyId);
    if (!linkedIds.length) return [];
    const q = filters.q?.trim();
    const tag = filters.tag?.trim();

    const candidates = await this.prisma.recruitCandidate.findMany({
      where: {
        id: { in: linkedIds },
        deletedAt: null,
        status: 'ACTIVE',
        ...(tag ? { tags: { has: tag } } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { headline: { contains: q, mode: 'insensitive' } },
                { city: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        applications: {
          where: { companyId: me.companyId },
          orderBy: { appliedAt: 'desc' },
          take: 1,
          select: { id: true, status: true, appliedAt: true, posting: { select: { title: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    const mapped = candidates.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      headline: c.headline,
      city: c.city,
      linkedinUrl: c.linkedinUrl,
      tags: c.tags,
      lastApplication: c.applications[0]
        ? { id: c.applications[0].id, status: c.applications[0].status, appliedAt: c.applications[0].appliedAt, vaga: c.applications[0].posting.title }
        : null,
    }));

    if (!filters.onlyAvailable) return mapped;
    return mapped.filter((c) => !c.lastApplication || CLOSED_STATUSES.includes(c.lastApplication.status));
  }

  /** Tags já usadas por candidatos vinculados a esta empresa — para autocomplete. */
  async listTags(me: AuthPayload): Promise<string[]> {
    const linkedIds = await this.linkedCandidateIds(me.companyId);
    if (!linkedIds.length) return [];
    const candidates = await this.prisma.recruitCandidate.findMany({ where: { id: { in: linkedIds } }, select: { tags: true } });
    const set = new Set<string>();
    for (const c of candidates) for (const t of c.tags) set.add(t);
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  async setTags(me: AuthPayload, candidateId: string, rawTags: unknown) {
    const linkedIds = await this.linkedCandidateIds(me.companyId);
    if (!linkedIds.includes(candidateId)) throw new NotFoundException('Candidato não encontrado.');
    const tags = [...new Set((Array.isArray(rawTags) ? rawTags : []).map((t) => String(t).trim()).filter(Boolean))].slice(0, MAX_TAGS);
    const saved = await this.prisma.recruitCandidate.update({ where: { id: candidateId }, data: { tags } });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitCandidate', entityId: candidateId, action: 'UPDATE', message: 'Tags do candidato atualizadas' });
    return { id: saved.id, tags: saved.tags };
  }

  /** IDs de candidato com pelo menos uma candidatura nesta empresa — é isso que autoriza a visibilidade (candidato é global). */
  private async linkedCandidateIds(companyId: string): Promise<string[]> {
    const rows = await this.prisma.recruitApplication.findMany({ where: { companyId }, distinct: ['candidateId'], select: { candidateId: true } });
    return rows.map((r) => r.candidateId);
  }
}
