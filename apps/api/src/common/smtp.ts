/**
 * Resolução central da configuração SMTP do sistema.
 *
 * Ordem de prioridade:
 *  1. Banco (Portal Global → E-mail): `PortalEmailSetting` + remetente padrão `PortalMailbox`.
 *  2. Variáveis de ambiente `SMTP_*` (compatibilidade com o que já existia).
 *
 * A senha fica cifrada (AES-256-GCM) e é decifrada apenas aqui, no momento do envio.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { decryptJson } from './crypto';

export interface ResolvedSmtp {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  fromName?: string;
  fromAddress?: string;
  replyTo?: string;
  source: 'db' | 'env';
}

/** Lê a configuração efetiva. `prisma` é tipado como any para evitar ciclo de import. */
export async function resolveSmtpConfig(prisma: any): Promise<ResolvedSmtp | null> {
  try {
    const row = await prisma.portalEmailSetting.findFirst({ orderBy: { createdAt: 'asc' } });
    if (row?.host && row.status !== 'disabled') {
      let pass: string | undefined;
      if (row.passwordEnc) {
        try {
          pass = decryptJson<{ pass: string }>(row.passwordEnc).pass;
        } catch {
          pass = undefined;
        }
      }
      let mailbox: any = null;
      try {
        mailbox =
          (await prisma.portalMailbox.findFirst({ where: { isDefault: true, active: true } })) ??
          (await prisma.portalMailbox.findFirst({ where: { active: true }, orderBy: { createdAt: 'asc' } }));
      } catch {
        mailbox = null;
      }
      return {
        host: String(row.host),
        port: Number.isFinite(Number(row.port)) ? Number(row.port) : 587,
        secure: Boolean(row.secure),
        user: row.username ?? undefined,
        pass,
        fromName: mailbox?.displayName ?? row.fromName ?? 'Gestão 360',
        fromAddress: mailbox?.address ?? row.fromAddress ?? row.username ?? undefined,
        replyTo: row.replyTo ?? undefined,
        source: 'db',
      };
    }
  } catch {
    // Tabela ainda não existe (antes da migração) — cai no fallback de ambiente.
  }

  if (process.env.SMTP_HOST) {
    return {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT ?? '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      fromName: process.env.SMTP_FROM_NAME,
      fromAddress: process.env.SMTP_FROM,
      source: 'env',
    };
  }

  return null;
}

/** Monta o cabeçalho From completo (ex.: `Gestão 360 <contato@gestao360.org>`). */
export function smtpFrom(cfg: ResolvedSmtp): string | undefined {
  if (!cfg.fromAddress) return undefined;
  return cfg.fromName ? `${cfg.fromName} <${cfg.fromAddress}>` : cfg.fromAddress;
}

export function buildTransport(cfg: ResolvedSmtp): Transporter {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
  });
}
