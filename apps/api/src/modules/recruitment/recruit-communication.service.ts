import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { buildTransport, resolveSmtpConfig, smtpFrom } from '../../common/smtp';
import { AuthPayload } from '../auth/auth.types';

const MODULE = 'recruitment';

/**
 * Comunicação automática com o candidato: um e-mail transacional por evento do funil,
 * com template configurável por empresa (Portal > Recrutamento > Comunicação). Sem
 * linha customizada no banco, usa o texto padrão embutido — funciona sem configuração,
 * e a empresa pode desligar (`active:false`) ou reescrever cada evento.
 *
 * Reusa a mesma infra central de e-mail (`common/smtp.ts`, já resolvendo Brevo/Resend
 * por HTTP ou SMTP:2525) usada pelo OTP do candidato, convites de entrevista e proposta
 * — este serviço só centraliza o TEXTO (antes hardcoded em 2 lugares, e ausente em outros
 * 4 eventos onde o candidato simplesmente não era avisado).
 */
export type RecruitEmailEvent = 'APPLICATION_RECEIVED' | 'STAGE_CHANGED' | 'REJECTED' | 'INTERVIEW_SCHEDULED' | 'OFFER_SENT' | 'ADMISSION_AUTHORIZED';

export const RECRUIT_EMAIL_EVENTS: RecruitEmailEvent[] = [
  'APPLICATION_RECEIVED',
  'STAGE_CHANGED',
  'REJECTED',
  'INTERVIEW_SCHEDULED',
  'OFFER_SENT',
  'ADMISSION_AUTHORIZED',
];

const EVENT_LABELS: Record<RecruitEmailEvent, string> = {
  APPLICATION_RECEIVED: 'Candidatura recebida',
  STAGE_CHANGED: 'Mudança de etapa',
  REJECTED: 'Candidatura encerrada',
  INTERVIEW_SCHEDULED: 'Entrevista agendada',
  OFFER_SENT: 'Proposta enviada',
  ADMISSION_AUTHORIZED: 'Admissão autorizada',
};

const EVENT_PLACEHOLDERS: Record<RecruitEmailEvent, string[]> = {
  APPLICATION_RECEIVED: ['candidato', 'vaga', 'empresa'],
  STAGE_CHANGED: ['candidato', 'vaga', 'empresa', 'etapa'],
  REJECTED: ['candidato', 'vaga', 'empresa', 'motivo'],
  INTERVIEW_SCHEDULED: ['candidato', 'vaga', 'empresa', 'data_hora', 'link', 'local', 'instrucoes'],
  OFFER_SENT: ['candidato', 'vaga', 'empresa', 'validade'],
  ADMISSION_AUTHORIZED: ['candidato', 'vaga', 'empresa'],
};

const DEFAULT_TEMPLATES: Record<RecruitEmailEvent, { subject: string; body: string }> = {
  APPLICATION_RECEIVED: {
    subject: 'Recebemos sua candidatura — {{vaga}}',
    body: 'Olá, {{candidato}}!\n\nRecebemos sua candidatura para a vaga de {{vaga}} em {{empresa}}. Nossa equipe vai analisar seu perfil e entraremos em contato sobre os próximos passos.\n\nVocê pode acompanhar o andamento a qualquer momento na área do candidato.\n\nBoa sorte!',
  },
  STAGE_CHANGED: {
    subject: 'Atualização da sua candidatura — {{vaga}}',
    body: 'Olá, {{candidato}}!\n\nSua candidatura para {{vaga}} em {{empresa}} avançou para a etapa: {{etapa}}.\n\nAcompanhe os detalhes na área do candidato.',
  },
  REJECTED: {
    subject: 'Retorno sobre sua candidatura — {{vaga}}',
    body: 'Olá, {{candidato}}!\n\nAgradecemos seu interesse na vaga de {{vaga}} em {{empresa}}. Após avaliação do processo, decidimos seguir com outro(a) candidato(a) neste momento.{{motivo}}\n\nSeu perfil fica em nosso banco de talentos para futuras oportunidades. Obrigado(a) por participar do processo seletivo!',
  },
  INTERVIEW_SCHEDULED: {
    subject: 'Entrevista agendada — {{vaga}}',
    body: 'Olá, {{candidato}}!\n\nSua entrevista para "{{vaga}}" foi agendada para {{data_hora}}.\n{{link}}{{local}}{{instrucoes}}\nCaso precise reagendar, responda este e-mail.',
  },
  OFFER_SENT: {
    subject: 'Proposta de trabalho — {{vaga}}',
    body: 'Olá, {{candidato}}!\n\nTemos uma proposta para você na vaga de {{vaga}} em {{empresa}}. Acesse a área do candidato para ver os detalhes e responder até {{validade}}.',
  },
  ADMISSION_AUTHORIZED: {
    subject: 'Parabéns! Sua admissão foi autorizada — {{vaga}}',
    body: 'Olá, {{candidato}}!\n\nSua admissão para a vaga de {{vaga}} em {{empresa}} foi autorizada. Em breve nossa equipe de Serviço Pessoal entrará em contato com os próximos passos da contratação.\n\nSeja bem-vindo(a)!',
  },
};

function render(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => vars[key] ?? '');
}

/** Nome de exibição da empresa para compor os e-mails ao candidato (usado por vários services do módulo). */
export async function resolveCompanyDisplayName(prisma: PrismaService, companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true, tradeName: true } });
  return company?.tradeName ?? company?.name ?? 'nossa empresa';
}

@Injectable()
export class RecruitCommunicationService {
  private readonly logger = new Logger(RecruitCommunicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
  ) {}

  /** Ponto único de disparo, chamado pelos outros services do módulo. Nunca lança — falha de e-mail não pode travar o fluxo de recrutamento. */
  async sendEvent(companyId: string, event: RecruitEmailEvent, to: string, vars: Record<string, string>): Promise<void> {
    try {
      const custom = await this.prisma.recruitEmailTemplate.findFirst({ where: { companyId, event } });
      if (custom && !custom.active) return; // empresa desligou este e-mail automático
      const subjectTpl = custom?.subject ?? DEFAULT_TEMPLATES[event].subject;
      const bodyTpl = custom?.bodyText ?? DEFAULT_TEMPLATES[event].body;
      const cfg = await resolveSmtpConfig(this.prisma);
      if (!cfg?.host) return;
      await buildTransport(cfg).sendMail({
        from: smtpFrom(cfg),
        to,
        subject: render(subjectTpl, vars),
        text: render(bodyTpl, vars),
      });
    } catch (err) {
      this.logger.warn(`Falha ao enviar e-mail de recrutamento (${event}) para ${to}: ${(err as Error).message}`);
    }
  }

  /** Lista os 6 eventos com o template efetivo (customizado ou padrão) — tela de configuração. */
  async listTemplates(me: AuthPayload) {
    const rows = await this.prisma.recruitEmailTemplate.findMany({ where: { companyId: me.companyId } });
    const byEvent = new Map(rows.map((r) => [r.event as RecruitEmailEvent, r]));
    return RECRUIT_EMAIL_EVENTS.map((event) => {
      const row = byEvent.get(event);
      return {
        event,
        label: EVENT_LABELS[event],
        placeholders: EVENT_PLACEHOLDERS[event],
        subject: row?.subject ?? DEFAULT_TEMPLATES[event].subject,
        bodyText: row?.bodyText ?? DEFAULT_TEMPLATES[event].body,
        active: row?.active ?? true,
        isCustom: Boolean(row),
        updatedAt: row?.updatedAt ?? null,
      };
    });
  }

  async upsertTemplate(me: AuthPayload, event: string, body: any = {}) {
    if (!RECRUIT_EMAIL_EVENTS.includes(event as RecruitEmailEvent)) throw new BadRequestException('Evento inválido.');
    const subject = String(body?.subject ?? '').trim();
    const bodyText = String(body?.bodyText ?? '').trim();
    if (!subject || !bodyText) throw new BadRequestException('Assunto e corpo do e-mail são obrigatórios.');
    const active = body?.active !== false;
    const saved = await this.prisma.recruitEmailTemplate.upsert({
      where: { companyId_event: { companyId: me.companyId, event } },
      create: { companyId: me.companyId, event, subject, bodyText, active, updatedById: me.sub },
      update: { subject, bodyText, active, updatedById: me.sub },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'RecruitEmailTemplate',
      entityId: saved.id,
      action: 'UPDATE',
      message: `Template de e-mail "${EVENT_LABELS[event as RecruitEmailEvent]}" atualizado`,
    });
    return this.listTemplates(me);
  }

  /** Remove a customização — volta a usar o texto padrão embutido. */
  async resetTemplate(me: AuthPayload, event: string) {
    if (!RECRUIT_EMAIL_EVENTS.includes(event as RecruitEmailEvent)) throw new BadRequestException('Evento inválido.');
    await this.prisma.recruitEmailTemplate.deleteMany({ where: { companyId: me.companyId, event } });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'RecruitEmailTemplate',
      entityId: event,
      action: 'DELETE',
      message: `Template de e-mail "${EVENT_LABELS[event as RecruitEmailEvent]}" restaurado ao padrão`,
    });
    return this.listTemplates(me);
  }
}
