import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { encryptJson } from '../../../common/crypto';
import { resolveSmtpConfig, buildTransport, smtpFrom } from '../../../common/smtp';
import { PlatformAdminAuditService } from './platform-admin-audit.service';
import { PlatformAdminIdentity } from '../platform-admin.types';

const PASSWORD_PLACEHOLDER = '••••••';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text : null;
}

/**
 * Portal Global → E-mail. Configura o servidor SMTP do sistema e gerencia os endereços
 * remetentes (ex.: contato@gestao360.org). A senha é cifrada e nunca volta ao frontend.
 */
@Injectable()
export class PlatformEmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PlatformAdminAuditService,
  ) {}

  // ---- Configuração SMTP ----

  private async settingRow() {
    return this.prisma.portalEmailSetting.findFirst({ orderBy: { createdAt: 'asc' } });
  }

  private mask(row: Awaited<ReturnType<PlatformEmailService['settingRow']>>) {
    if (!row) {
      const envConfigured = Boolean(process.env.SMTP_HOST);
      return {
        configured: envConfigured,
        source: envConfigured ? 'env' : 'none',
        host: process.env.SMTP_HOST ?? null,
        port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
        secure: process.env.SMTP_SECURE === 'true',
        username: process.env.SMTP_USER ?? null,
        hasPassword: Boolean(process.env.SMTP_PASS),
        fromName: process.env.SMTP_FROM_NAME ?? null,
        fromAddress: process.env.SMTP_FROM ?? null,
        replyTo: null,
        status: 'active',
        lastTestAt: null,
        lastTestOk: null,
        lastTestError: null,
      };
    }
    return {
      configured: Boolean(row.host),
      source: 'db',
      host: row.host,
      port: row.port,
      secure: row.secure,
      username: row.username,
      hasPassword: Boolean(row.passwordEnc),
      fromName: row.fromName,
      fromAddress: row.fromAddress,
      replyTo: row.replyTo,
      status: row.status,
      lastTestAt: row.lastTestAt,
      lastTestOk: row.lastTestOk,
      lastTestError: row.lastTestError,
    };
  }

  async getSettings() {
    return this.mask(await this.settingRow());
  }

  async updateSettings(user: PlatformAdminIdentity, body: Record<string, any>) {
    const existing = await this.settingRow();
    const data: Record<string, any> = {
      host: clean(body.host),
      port: Number.isFinite(Number(body.port)) ? Number(body.port) : 587,
      secure: Boolean(body.secure),
      username: clean(body.username),
      fromName: clean(body.fromName),
      fromAddress: clean(body.fromAddress),
      replyTo: clean(body.replyTo),
      status: body.status === 'disabled' ? 'disabled' : 'active',
      updatedBy: user.sub,
    };
    if (data.fromAddress && !EMAIL_RE.test(data.fromAddress)) {
      throw new BadRequestException('Endereço remetente (From) inválido.');
    }
    // Senha só é alterada quando enviada e diferente do placeholder mascarado.
    if (typeof body.password === 'string' && body.password.length && body.password !== PASSWORD_PLACEHOLDER) {
      data.passwordEnc = encryptJson({ pass: body.password });
    } else if (body.clearPassword === true) {
      data.passwordEnc = null;
    }

    const row = existing
      ? await this.prisma.portalEmailSetting.update({ where: { id: existing.id }, data })
      : await this.prisma.portalEmailSetting.create({ data });

    await this.audit.record({
      user,
      action: 'PORTAL_EMAIL_SETTINGS_UPDATE',
      permissionKey: 'platform.integrations.manage',
      targetType: 'email-setting',
      targetId: row.id,
      afterValue: { host: row.host, port: row.port, secure: row.secure, username: row.username, fromAddress: row.fromAddress, status: row.status },
    });
    return this.mask(row);
  }

  // ---- Caixas / remetentes ----

  async listMailboxes() {
    return this.prisma.portalMailbox.findMany({ orderBy: [{ isDefault: 'desc' }, { address: 'asc' }] });
  }

  async createMailbox(user: PlatformAdminIdentity, body: Record<string, any>) {
    const address = clean(body.address)?.toLowerCase();
    if (!address || !EMAIL_RE.test(address)) throw new BadRequestException('Informe um endereço de e-mail válido.');
    const exists = await this.prisma.portalMailbox.findUnique({ where: { address } });
    if (exists) throw new BadRequestException('Este endereço já está cadastrado.');

    const makeDefault = Boolean(body.isDefault) || (await this.prisma.portalMailbox.count()) === 0;
    if (makeDefault) await this.prisma.portalMailbox.updateMany({ data: { isDefault: false } });

    const row = await this.prisma.portalMailbox.create({
      data: {
        address,
        displayName: clean(body.displayName),
        purpose: clean(body.purpose),
        notes: clean(body.notes),
        active: body.active === false ? false : true,
        isDefault: makeDefault,
        createdBy: user.sub,
      },
    });
    await this.audit.record({ user, action: 'PORTAL_MAILBOX_CREATE', permissionKey: 'platform.integrations.manage', targetType: 'mailbox', targetId: row.id, targetLabel: row.address, afterValue: { address: row.address, isDefault: row.isDefault } });
    return row;
  }

  async updateMailbox(user: PlatformAdminIdentity, id: string, body: Record<string, any>) {
    const current = await this.prisma.portalMailbox.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Endereço não encontrado.');

    const data: Record<string, any> = {
      displayName: clean(body.displayName),
      purpose: clean(body.purpose),
      notes: clean(body.notes),
    };
    if (typeof body.active === 'boolean') data.active = body.active;
    if (typeof body.address === 'string') {
      const address = clean(body.address)?.toLowerCase();
      if (!address || !EMAIL_RE.test(address)) throw new BadRequestException('Endereço de e-mail inválido.');
      if (address !== current.address) {
        const dup = await this.prisma.portalMailbox.findUnique({ where: { address } });
        if (dup) throw new BadRequestException('Este endereço já está cadastrado.');
        data.address = address;
      }
    }
    if (body.isDefault === true) {
      await this.prisma.portalMailbox.updateMany({ data: { isDefault: false } });
      data.isDefault = true;
      data.active = true;
    }

    const row = await this.prisma.portalMailbox.update({ where: { id }, data });
    await this.audit.record({ user, action: 'PORTAL_MAILBOX_UPDATE', permissionKey: 'platform.integrations.manage', targetType: 'mailbox', targetId: row.id, targetLabel: row.address, afterValue: { address: row.address, isDefault: row.isDefault, active: row.active } });
    return row;
  }

  async setDefaultMailbox(user: PlatformAdminIdentity, id: string) {
    const current = await this.prisma.portalMailbox.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Endereço não encontrado.');
    await this.prisma.portalMailbox.updateMany({ data: { isDefault: false } });
    const row = await this.prisma.portalMailbox.update({ where: { id }, data: { isDefault: true, active: true } });
    await this.audit.record({ user, action: 'PORTAL_MAILBOX_SET_DEFAULT', permissionKey: 'platform.integrations.manage', targetType: 'mailbox', targetId: row.id, targetLabel: row.address });
    return row;
  }

  async deleteMailbox(user: PlatformAdminIdentity, id: string) {
    const current = await this.prisma.portalMailbox.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Endereço não encontrado.');
    await this.prisma.portalMailbox.delete({ where: { id } });
    // Se removeu o padrão, promove outro ativo.
    if (current.isDefault) {
      const next = await this.prisma.portalMailbox.findFirst({ where: { active: true }, orderBy: { createdAt: 'asc' } });
      if (next) await this.prisma.portalMailbox.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    await this.audit.record({ user, action: 'PORTAL_MAILBOX_DELETE', permissionKey: 'platform.integrations.manage', targetType: 'mailbox', targetId: id, targetLabel: current.address });
    return { ok: true };
  }

  // ---- Teste de envio ----

  async sendTest(user: PlatformAdminIdentity, body: Record<string, any>) {
    const cfg = await resolveSmtpConfig(this.prisma);
    if (!cfg?.host) throw new BadRequestException('Configure o servidor SMTP antes de enviar o teste.');

    const to = clean(body.to) ?? cfg.fromAddress ?? cfg.user;
    if (!to || !EMAIL_RE.test(to)) throw new BadRequestException('Informe um destinatário válido para o teste.');

    const from = smtpFrom(cfg);
    let ok = false;
    let error: string | null = null;
    try {
      const transporter = buildTransport(cfg);
      await transporter.sendMail({
        from,
        to,
        replyTo: cfg.replyTo,
        subject: 'Teste de e-mail — Gestão 360',
        text: `Este é um e-mail de teste enviado pelo Portal Administrativo Global.\n\nServidor: ${cfg.host}:${cfg.port}\nRemetente: ${from ?? '(não definido)'}\nOrigem da configuração: ${cfg.source === 'db' ? 'banco (Portal Global)' : 'variáveis de ambiente'}.\n\nSe você recebeu esta mensagem, o envio de e-mails está funcionando.`,
      });
      ok = true;
    } catch (e) {
      error = (e as Error).message?.split('\n')[0]?.slice(0, 200) ?? 'Falha desconhecida no envio.';
    }

    // Registra o resultado do teste na configuração persistida (se houver linha no banco).
    const row = await this.settingRow();
    if (row) {
      await this.prisma.portalEmailSetting
        .update({ where: { id: row.id }, data: { lastTestAt: new Date(), lastTestOk: ok, lastTestError: error } })
        .catch(() => undefined);
    }
    await this.audit.record({
      user,
      action: 'PORTAL_EMAIL_TEST',
      permissionKey: 'platform.integrations.manage',
      targetType: 'email-setting',
      result: ok ? 'SUCCESS' : 'ERROR',
      afterValue: { to, source: cfg.source },
    });

    return { ok, to, from: from ?? null, source: cfg.source, error };
  }
}
