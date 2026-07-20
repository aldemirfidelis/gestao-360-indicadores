import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { resolveSmtpConfig, buildTransport, smtpFrom } from '../../../common/smtp';

@Injectable()
export class WorkflowIntegrationService {
  private readonly logger = new Logger(WorkflowIntegrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async executeIntegrationBlock(
    instance: any,
    blockType: string,
    config: any,
    context: any
  ): Promise<any> {
    const companyId = instance.companyId;

    if (blockType === 'integration.webhook') {
      const url = config.url;
      const method = config.method || 'POST';
      const headers = config.headers ? JSON.parse(config.headers) : {};
      const bodyTemplate = config.body || '{}';

      // Interpolate body variables
      const bodyStr = this.interpolate(bodyTemplate, context);
      
      this.logger.log(`Executing Webhook integration: ${method} to ${url}`);

      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: method !== 'GET' && method !== 'HEAD' ? bodyStr : undefined,
        });

        const status = response.status;
        const text = await response.text();
        let json: any = {};
        try {
          json = JSON.parse(text);
        } catch (_) {
          json = { raw: text };
        }

        if (status >= 400) {
          throw new Error(`Webhook responded with status ${status}: ${text.slice(0, 100)}`);
        }

        return {
          webhookStatus: status,
          webhookResponse: json,
        };
      } catch (error: any) {
        this.logger.error(`Webhook integration failed: ${error.message}`, error.stack);
        throw error;
      }
    }

    if (blockType === 'integration.email') {
      // Mock sending email or use generic nodemailer
      const to = this.interpolate(config.to || '', context);
      const subject = this.interpolate(config.subject || '', context);
      const body = this.interpolate(config.body || '', context);

      this.logger.log(`Sending automated workflow email to ${to}: ${subject}`);

      // Envio real pelo mesmo caminho central de e-mail (Portal Global → E-mail).
      // Falha não derruba o workflow: registra status ERROR e segue.
      let sent = false;
      let errorMsg: string | null = null;
      try {
        if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new Error('Destinatário de e-mail inválido.');
        const cfg = await resolveSmtpConfig(this.prisma);
        if (!cfg?.host) throw new Error('E-mail não configurado (Portal Global → E-mail).');
        const looksHtml = /<[a-z][\s\S]*>/i.test(body);
        await buildTransport(cfg).sendMail({
          from: smtpFrom(cfg),
          to,
          subject,
          text: body,
          ...(looksHtml ? { html: body } : {}),
          replyTo: cfg.replyTo,
        });
        sent = true;
      } catch (e) {
        errorMsg = (e as Error).message;
        this.logger.warn(`Falha ao enviar e-mail do workflow para ${to}: ${errorMsg}`);
      }

      // Save mail logs inside system
      await this.prisma.emailLog.create({
        data: {
          companyId,
          recipientEmail: to,
          subject,
          body,
          status: sent ? 'SENT' : 'ERROR',
        },
      });

      return { emailSent: sent, recipient: to, ...(errorMsg ? { error: errorMsg } : {}) };
    }

    return {};
  }

  private interpolate(str: string, context: any): string {
    return str.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const parts = key.trim().split('.');
      let val = context;
      for (const p of parts) {
        if (val === null || val === undefined) return '';
        val = val[p];
      }
      return val !== undefined ? String(val) : '';
    });
  }
}
