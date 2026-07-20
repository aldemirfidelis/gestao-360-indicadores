import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { AuthPayload } from '../auth/auth.types';

const MODULE = 'recruitment';
const RESOLUTION_ACTIONS = ['DONE', 'REJECTED'];

/**
 * Atendimento (F3) das solicitações de direitos do titular abertas pelo candidato
 * (`RecruitDataRequest`): fila para a empresa, exportação de dados (acesso/portabilidade)
 * e anonimização (exclusão). O candidato só ABRE o pedido pelo portal; esta é a
 * ponta que resolve.
 */
@Injectable()
export class RecruitLgpdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
  ) {}

  async listRequests(me: AuthPayload, filters: { status?: string; type?: string } = {}) {
    const status = text(filters.status)?.toUpperCase();
    const type = text(filters.type)?.toUpperCase();
    return this.prisma.recruitDataRequest.findMany({
      where: { companyId: me.companyId, ...(status ? { status } : {}), ...(type ? { type } : {}) },
      orderBy: [{ status: 'asc' }, { requestedAt: 'asc' }],
      include: { candidate: { select: { id: true, name: true, email: true, status: true } } },
    });
  }

  async getRequest(me: AuthPayload, id: string) {
    return this.requestOrFail(me.companyId, id);
  }

  /** Bundle legível dos dados que a empresa guarda do candidato (acesso/portabilidade). */
  async exportCandidateData(me: AuthPayload, candidateId: string) {
    // Candidato é global: autoriza pelo vínculo (candidatura a uma vaga DESTA empresa).
    const candidate = await this.prisma.recruitCandidate.findFirst({ where: { id: candidateId } });
    if (!candidate) throw new NotFoundException('Candidato não encontrado.');
    const linked = await this.prisma.recruitApplication.count({ where: { candidateId, companyId: me.companyId } });
    if (!linked) throw new NotFoundException('Candidato não encontrado.');

    const [applications, documents, consents, offers] = await Promise.all([
      this.prisma.recruitApplication.findMany({
        where: { candidateId, companyId: me.companyId },
        orderBy: { appliedAt: 'desc' },
        include: {
          posting: { select: { title: true, slug: true } },
          events: { orderBy: { createdAt: 'asc' }, select: { type: true, note: true, createdAt: true } },
          screeningAnswers: { include: { question: { select: { question: true } } } },
        },
      }),
      this.prisma.recruitCandidateDocument.findMany({
        where: { candidateId, companyId: me.companyId, deletedAt: null },
        select: { id: true, kind: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
      }),
      this.prisma.recruitConsent.findMany({ where: { candidateId, companyId: me.companyId }, orderBy: { grantedAt: 'desc' } }),
      this.prisma.recruitOffer.findMany({
        where: { companyId: me.companyId, application: { candidateId } },
        select: { id: true, status: true, salaryAmountCents: true, currency: true, sentAt: true, acceptedAt: true, declinedAt: true },
      }),
    ]);

    await this.audit.record(me, {
      module: MODULE,
      entity: 'RecruitCandidate',
      entityId: candidateId,
      action: 'EXPORT',
      message: `Exportação de dados do candidato ${candidate.name} (LGPD)`,
    });

    return {
      exportedAt: new Date().toISOString(),
      candidate: {
        id: candidate.id,
        email: candidate.email,
        name: candidate.name,
        phone: candidate.phone,
        headline: candidate.headline,
        city: candidate.city,
        linkedinUrl: candidate.linkedinUrl,
        portfolioUrl: candidate.portfolioUrl,
        profileData: candidate.profileData,
        createdAt: candidate.createdAt,
      },
      applications,
      documents,
      consents,
      offers,
    };
  }

  /** Encerra a solicitação. DELETION concluída dispara a anonimização do candidato. */
  async resolveRequest(me: AuthPayload, id: string, body: any = {}) {
    const request = await this.requestOrFail(me.companyId, id);
    if (request.status !== 'OPEN') throw new ConflictException('Esta solicitação já foi encerrada.');
    const action = String(body?.action ?? '').toUpperCase();
    if (!RESOLUTION_ACTIONS.includes(action)) throw new BadRequestException('Ação inválida (DONE ou REJECTED).');

    if (action === 'DONE' && request.type === 'DELETION') {
      await this.anonymizeCandidate(me, request.candidateId);
    }

    const note = text(body?.note);
    const details = note ? [request.details, `Resolução (${action}): ${note}`].filter(Boolean).join('\n\n') : request.details;
    const saved = await this.prisma.recruitDataRequest.update({
      where: { id },
      data: { status: action, resolvedAt: new Date(), resolvedById: me.sub, details },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'RecruitDataRequest',
      entityId: id,
      action: action === 'DONE' ? 'RESOLVE' : 'REJECT',
      message: `Solicitação LGPD (${request.type}) do candidato ${request.candidateId} ${action === 'DONE' ? 'atendida' : 'recusada'}`,
    });
    return saved;
  }

  /** Anonimiza PII do candidato e remove seus documentos; preserva o histórico da candidatura para defesa legal do processo seletivo. */
  private async anonymizeCandidate(me: AuthPayload, candidateId: string) {
    const candidate = await this.prisma.recruitCandidate.findFirst({ where: { id: candidateId } });
    if (!candidate || candidate.status === 'ANONYMIZED') return;
    // Candidato é GLOBAL: uma empresa não pode apagar a identidade se ele tem candidaturas
    // em OUTRAS empresas — nesse caso remove só os documentos desta empresa.
    const otherCompanyApps = await this.prisma.recruitApplication.count({ where: { candidateId, companyId: { not: me.companyId } } });
    if (otherCompanyApps > 0) {
      await this.prisma.recruitCandidateDocument.updateMany({ where: { candidateId, companyId: me.companyId, deletedAt: null }, data: { deletedAt: new Date() } });
      await this.audit.record(me, { module: MODULE, entity: 'RecruitCandidate', entityId: candidateId, action: 'ANONYMIZE', message: 'Dados do candidato nesta empresa removidos (identidade global preservada — há candidaturas em outras empresas)' });
      return;
    }
    const placeholder = `anonimizado+${candidate.id}@removido.invalid`;
    await this.prisma.$transaction([
      this.prisma.recruitCandidate.update({
        where: { id: candidateId },
        data: {
          name: 'Candidato anonimizado',
          email: placeholder,
          emailNormalized: placeholder,
          phone: null,
          headline: null,
          city: null,
          linkedinUrl: null,
          portfolioUrl: null,
          profileData: Prisma.JsonNull,
          passwordHash: null,
          status: 'ANONYMIZED',
          deletedAt: new Date(),
        },
      }),
      this.prisma.recruitCandidateDocument.updateMany({
        where: { candidateId, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      this.prisma.recruitCandidateOtp.deleteMany({ where: { candidateId } }),
    ]);
    await this.audit.record(me, {
      module: MODULE,
      entity: 'RecruitCandidate',
      entityId: candidateId,
      action: 'ANONYMIZE',
      message: 'Candidato anonimizado por solicitação LGPD de exclusão',
    });
  }

  private async requestOrFail(companyId: string, id: string) {
    const request = await this.prisma.recruitDataRequest.findFirst({
      where: { id, companyId },
      include: { candidate: { select: { id: true, name: true, email: true, status: true } } },
    });
    if (!request) throw new NotFoundException('Solicitação não encontrada.');
    return request;
  }
}

function text(value: unknown): string | null {
  const t = String(value ?? '').trim();
  return t || null;
}
