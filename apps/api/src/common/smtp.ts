/**
 * Resolução central da configuração de e-mail do sistema.
 *
 * Ordem de prioridade:
 *  0. Provedor por API HTTPS (env `RESEND_API_KEY` ou `BREVO_API_KEY` + `EMAIL_FROM`).
 *     Usa a porta 443 e contorna o bloqueio de SMTP de saída (25/465/587) de provedores
 *     como a DigitalOcean — o SMTP clássico dá "Connection timeout" nesses ambientes.
 *  1. Banco (Portal Global → E-mail): `PortalEmailSetting` + remetente padrão `PortalMailbox`.
 *  2. Variáveis de ambiente `SMTP_*` (compatibilidade com o que já existia).
 *
 * A senha fica cifrada (AES-256-GCM) e é decifrada apenas aqui, no momento do envio.
 * Todos os pontos de envio usam `buildTransport(cfg).sendMail(...)`, então o caminho HTTP
 * fica transparente: `buildTransport` devolve um transporter que fala com a API HTTPS.
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
  source: 'db' | 'env' | 'http';
  /** 'smtp' (nodemailer) ou 'http' (API HTTPS do provedor). Ausente = 'smtp'. */
  transport?: 'smtp' | 'http';
  httpProvider?: 'resend' | 'brevo';
  apiKey?: string;
}

/**
 * Provedor por API HTTPS via env. Só ativa quando há uma API key E um remetente
 * (`EMAIL_FROM`, com fallback ao `SMTP_FROM`). Tem prioridade sobre o SMTP porque é o
 * caminho que funciona onde a saída SMTP está bloqueada.
 */
function resolveHttpEmailProvider(): ResolvedSmtp | null {
  const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (!fromAddress) return null;
  const fromName = process.env.EMAIL_FROM_NAME || process.env.SMTP_FROM_NAME || 'Gestão 360';
  const replyTo = process.env.EMAIL_REPLY_TO || undefined;
  const base = { host: 'https-email-api', port: 443, secure: true, fromName, fromAddress, replyTo, source: 'http' as const, transport: 'http' as const };
  if (process.env.RESEND_API_KEY) return { ...base, httpProvider: 'resend', apiKey: process.env.RESEND_API_KEY };
  if (process.env.BREVO_API_KEY) return { ...base, httpProvider: 'brevo', apiKey: process.env.BREVO_API_KEY };
  return null;
}

/** Lê a configuração efetiva. `prisma` é tipado como any para evitar ciclo de import. */
export async function resolveSmtpConfig(prisma: any): Promise<ResolvedSmtp | null> {
  const http = resolveHttpEmailProvider();
  if (http) return http;
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

function smtpTimeout(name: string, fallback: number): number {
  const configured = Number(process.env[name]);
  return Number.isFinite(configured) && configured > 0 ? configured : fallback;
}

export function buildTransport(cfg: ResolvedSmtp): Transporter {
  if (cfg.transport === 'http') return httpTransport(cfg);
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    // Falhas de rede não podem prender formulários e rotinas do portal por vários
    // minutos. Os limites também valem para testes, convites e notificações.
    connectionTimeout: smtpTimeout('SMTP_CONNECTION_TIMEOUT_MS', 10_000),
    greetingTimeout: smtpTimeout('SMTP_GREETING_TIMEOUT_MS', 10_000),
    socketTimeout: smtpTimeout('SMTP_SOCKET_TIMEOUT_MS', 20_000),
  });
}

interface OutgoingMail {
  to?: string | string[];
  cc?: string | string[];
  subject?: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

/**
 * "Transporter" que envia pela API HTTPS do provedor (Resend/Brevo) em vez de SMTP.
 * Expõe a mesma superfície `.sendMail(msg)` que os callers já usam, então nada mais muda.
 */
function httpTransport(cfg: ResolvedSmtp): Transporter {
  const toList = (v?: string | string[]): string[] =>
    (Array.isArray(v) ? v : v ? [v] : []).flatMap((x) => String(x).split(',')).map((s) => s.trim()).filter(Boolean);

  const sendMail = async (msg: OutgoingMail) => {
    const to = [...toList(msg.to), ...toList(msg.cc)];
    if (!to.length) throw new Error('Envio HTTP sem destinatário.');
    const replyTo = msg.replyTo ?? cfg.replyTo;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(process.env.EMAIL_HTTP_TIMEOUT_MS) || 15_000);
    try {
      let url: string;
      let headers: Record<string, string>;
      let body: string;
      if (cfg.httpProvider === 'brevo') {
        url = 'https://api.brevo.com/v3/smtp/email';
        headers = { 'api-key': cfg.apiKey ?? '', 'content-type': 'application/json', accept: 'application/json' };
        body = JSON.stringify({
          sender: { email: cfg.fromAddress, name: cfg.fromName },
          to: to.map((email) => ({ email })),
          subject: msg.subject ?? '',
          ...(msg.text ? { textContent: msg.text } : {}),
          ...(msg.html ? { htmlContent: msg.html } : {}),
          ...(replyTo ? { replyTo: { email: replyTo } } : {}),
        });
      } else {
        // Resend (padrão).
        url = 'https://api.resend.com/emails';
        headers = { authorization: `Bearer ${cfg.apiKey ?? ''}`, 'content-type': 'application/json' };
        body = JSON.stringify({
          from: cfg.fromName ? `${cfg.fromName} <${cfg.fromAddress}>` : cfg.fromAddress,
          to,
          subject: msg.subject ?? '',
          ...(msg.text ? { text: msg.text } : {}),
          ...(msg.html ? { html: msg.html } : {}),
          ...(replyTo ? { reply_to: replyTo } : {}),
        });
      }
      const res = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Provedor de e-mail (${cfg.httpProvider}) HTTP ${res.status}: ${detail.slice(0, 300)}`);
      }
      return { accepted: to, rejected: [], response: `HTTP ${res.status}` };
    } finally {
      clearTimeout(timer);
    }
  };

  // `verify()` para telas de teste: apenas confirma que há API key configurada.
  const verify = async () => {
    if (!cfg.apiKey) throw new Error('API key do provedor de e-mail ausente.');
    return true;
  };

  return { sendMail, verify } as unknown as Transporter;
}
