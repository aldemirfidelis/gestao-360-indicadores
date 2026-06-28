import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { buildTransport, resolveSmtpConfig, smtpFrom } from '../../common/smtp';
import { PrismaService } from '../../prisma/prisma.service';
import { PublicContactDto, PublicContactRequestType } from './public-contact.dto';

const SUPPORT_REQUEST_TYPES = new Set<PublicContactRequestType>([
  'Suporte',
  'Suporte técnico',
  'Dúvida de acesso',
  'SAC',
  'LGPD e privacidade',
]);

function clean(value?: string): string {
  return value?.trim() ?? '';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function publicContactDestination(requestType: PublicContactRequestType): string {
  if (SUPPORT_REQUEST_TYPES.has(requestType)) {
    return process.env.PUBLIC_SUPPORT_EMAIL?.trim() || 'suporte@gestao360.org';
  }
  return process.env.PUBLIC_CONTACT_EMAIL?.trim() || 'contato@gestao360.org';
}

@Injectable()
export class PublicContactService {
  private readonly logger = new Logger(PublicContactService.name);

  constructor(private readonly prisma: PrismaService) {}

  async send(input: PublicContactDto): Promise<{ ok: true }> {
    // Bots recebem uma resposta neutra, sem disparar e-mail nem revelar a proteção.
    if (clean(input.website)) return { ok: true };

    const name = clean(input.name);
    const company = clean(input.company);
    const role = clean(input.role);
    const email = clean(input.email).toLowerCase();
    const phone = clean(input.phone);
    const message = clean(input.message);

    // 1. Salvar no banco de dados primeiro
    try {
      await this.prisma.publicContactMessage.create({
        data: {
          name,
          company,
          role: role || null,
          email,
          phone: phone || null,
          requestType: input.requestType,
          message,
        },
      });
      this.logger.log(`Mensagem de contato de ${email} persistida com sucesso.`);
    } catch (dbError) {
      this.logger.error(
        {
          event: 'public_contact_db_save_failed',
          email,
          error: dbError instanceof Error ? dbError.message : 'unknown',
        },
        'Falha ao persistir mensagem de contato no banco de dados.',
      );
      throw new ServiceUnavailableException('Não foi possível registrar a mensagem.');
    }

    // 2. Enviar por e-mail (caso configurado)
    const smtp = await resolveSmtpConfig(this.prisma);
    if (!smtp?.host) {
      this.logger.warn('Formulário público recebido sem SMTP configurado. Mensagem salva apenas em banco.');
      return { ok: true };
    }

    const destination = publicContactDestination(input.requestType);
    const subject = `[Gestão 360] ${input.requestType} — ${company}`;
    const details = [
      `Nome: ${name}`,
      `Empresa: ${company}`,
      `Cargo: ${role || 'Não informado'}`,
      `E-mail: ${email}`,
      `Telefone: ${phone || 'Não informado'}`,
      `Tipo: ${input.requestType}`,
      '',
      'Mensagem:',
      message,
    ].join('\n');

    try {
      const transporter = buildTransport(smtp);
      await transporter.sendMail({
        from: smtpFrom(smtp),
        to: destination,
        replyTo: email,
        subject,
        text: details,
        html: `
          <h2>${escapeHtml(input.requestType)}</h2>
          <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
            <tr><td><strong>Nome</strong></td><td>${escapeHtml(name)}</td></tr>
            <tr><td><strong>Empresa</strong></td><td>${escapeHtml(company)}</td></tr>
            <tr><td><strong>Cargo</strong></td><td>${escapeHtml(role || 'Não informado')}</td></tr>
            <tr><td><strong>E-mail</strong></td><td>${escapeHtml(email)}</td></tr>
            <tr><td><strong>Telefone</strong></td><td>${escapeHtml(phone || 'Não informado')}</td></tr>
            <tr><td><strong>Tipo</strong></td><td>${escapeHtml(input.requestType)}</td></tr>
          </table>
          <h3>Mensagem</h3>
          <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
        `,
      });
      this.logger.log({
        event: 'public_contact_email_sent',
        requestType: input.requestType,
        destination,
      });
    } catch (error) {
      this.logger.error(
        {
          event: 'public_contact_email_failed',
          requestType: input.requestType,
          destination,
          error: error instanceof Error ? error.message : 'unknown',
        },
        'Falha ao enviar formulário público por e-mail. A mensagem foi salva no banco.',
      );
    }

    return { ok: true };
  }
}
