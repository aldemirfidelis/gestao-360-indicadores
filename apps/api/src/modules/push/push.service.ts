import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../../prisma/prisma.service';

export interface PushPayload {
  title: string;
  body?: string;
  link?: string;
  tag?: string;
  icon?: string;
}

export interface WebPushSubscriptionInput {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
}

/**
 * Web Push (PWA) para Android e iOS (16.4+ instalado como app).
 * Inerte enquanto as VAPID keys nao estiverem configuradas (VAPID_PUBLIC_KEY /
 * VAPID_PRIVATE_KEY), seguindo o padrao do StorageService.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly publicKey = process.env.VAPID_PUBLIC_KEY?.trim() || '';
  private readonly privateKey = process.env.VAPID_PRIVATE_KEY?.trim() || '';
  private readonly subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:contato@gestao360.org';
  readonly isEnabled: boolean;

  constructor(private readonly prisma: PrismaService) {
    this.isEnabled = Boolean(this.publicKey && this.privateKey);
    if (this.isEnabled) {
      try {
        webpush.setVapidDetails(this.subject, this.publicKey, this.privateKey);
      } catch (err) {
        this.logger.error({ event: 'vapid_setup_failed', error: err instanceof Error ? err.message : 'unknown' });
      }
    } else {
      this.logger.warn('Web Push inativo: defina VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY para habilitar notificacoes push.');
    }
  }

  getPublicKey(): { publicKey: string | null } {
    return { publicKey: this.isEnabled ? this.publicKey : null };
  }

  async subscribe(userId: string, companyId: string | null, sub: WebPushSubscriptionInput) {
    const endpoint = sub?.endpoint?.trim();
    const p256dh = sub?.keys?.p256dh?.trim();
    const auth = sub?.keys?.auth?.trim();
    if (!endpoint || !p256dh || !auth) {
      return { ok: false };
    }
    await this.prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId, companyId, endpoint, p256dh, auth },
      update: { userId, companyId, p256dh, auth },
    });
    return { ok: true };
  }

  async unsubscribe(endpoint: string) {
    if (!endpoint) return { ok: false };
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
    return { ok: true };
  }

  /** Envia um push para todos os dispositivos inscritos de um usuario. Nao lanca. */
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.isEnabled) return;
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
    if (subs.length === 0) return;
    const data = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, data);
        } catch (err: any) {
          const status = err?.statusCode;
          // 404/410 => inscricao expirada/cancelada: removemos.
          if (status === 404 || status === 410) {
            await this.prisma.pushSubscription.deleteMany({ where: { endpoint: s.endpoint } }).catch(() => undefined);
          } else {
            this.logger.warn({ event: 'push_send_failed', status, endpoint: s.endpoint.slice(0, 48) });
          }
        }
      }),
    );
  }
}
