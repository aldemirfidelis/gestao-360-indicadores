import { Inject, Injectable, Logger } from '@nestjs/common';
import { PresenceStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PRESENCE_STORE, PresenceStore, PresenceSnapshot } from './presence.store';
import { WS } from '../communication.events';
import { RealtimeEmitter } from '../realtime.emitter';

/**
 * Fonte única de presença online. Mantém o estado vivo no `PresenceStore`
 * (memória, Redis-ready), descarrega `lastSeenAt`/status no Postgres como
 * fallback durável e transmite as mudanças por WebSocket via RealtimeEmitter.
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private readonly socketContexts = new Map<string, { userId: string; companyId: string }>();

  /** Tempo de inatividade até marcar AWAY (configurável). */
  readonly awayMs = Number(process.env.PRESENCE_AWAY_MS ?? 5 * 60_000);

  constructor(
    @Inject(PRESENCE_STORE) private readonly store: PresenceStore,
    private readonly prisma: PrismaService,
    private readonly emitter: RealtimeEmitter,
  ) {}

  async connect(userId: string, socketId: string, companyId: string) {
    this.socketContexts.set(socketId, { userId, companyId });
    const { firstConnection } = this.store.addConnection(userId, socketId);
    if (firstConnection) {
      await this.persist(userId);
    }
    this.broadcastUser(userId, companyId);
    this.broadcastCount(companyId);
  }

  async disconnect(userId: string, socketId: string, companyId: string) {
    this.socketContexts.delete(socketId);
    const { lastConnection } = this.store.removeConnection(userId, socketId);
    if (lastConnection) {
      await this.persist(userId);
    }
    this.broadcastUser(userId, companyId, this.hasCompanyConnection(userId, companyId) ? undefined : PresenceStatus.OFFLINE);
    this.broadcastCount(companyId);
  }

  async heartbeat(userId: string, active: boolean, companyId: string) {
    const before = this.store.effectiveStatus(userId);
    this.store.markActivity(userId, active);
    const after = this.store.effectiveStatus(userId);
    if (before !== after) {
      await this.persist(userId);
      this.broadcastUserToActiveCompanies(userId, companyId);
    }
  }

  async setManualStatus(userId: string, status: PresenceStatus | null, companyId: string) {
    this.store.setManualStatus(userId, status);
    await this.persist(userId);
    this.broadcastUserToActiveCompanies(userId, companyId);
  }

  /** Varredura periódica de ociosidade (chamada pelo gateway). */
  async sweep() {
    const flipped = this.store.sweepIdle(this.awayMs);
    for (const userId of flipped) {
      await this.persist(userId);
      this.broadcastUserToActiveCompanies(userId);
    }
  }

  onlineUserIds(): string[] {
    return this.store.onlineUserIds();
  }

  onlineCount(companyId?: string): number {
    if (!companyId) return this.store.onlineCount();
    const users = new Set<string>();
    for (const context of this.socketContexts.values()) {
      if (context.companyId === companyId) users.add(context.userId);
    }
    return users.size;
  }

  status(userId: string): PresenceStatus {
    return this.store.effectiveStatus(userId);
  }

  snapshotFor(userIds: string[]): Record<string, PresenceSnapshot> {
    return this.store.snapshotFor(userIds);
  }

  private async persist(userId: string) {
    const status = this.store.effectiveStatus(userId);
    try {
      await this.prisma.userPresence.upsert({
        where: { userId },
        create: { userId, status, lastSeenAt: new Date() },
        update: { status, lastSeenAt: new Date() },
      });
    } catch (err) {
      // Presença é tolerante a falhas: o estado vivo continua em memória.
      this.logger.warn(`Falha ao persistir presença de ${userId}: ${(err as Error).message}`);
    }
  }

  private broadcastUser(userId: string, companyId: string, status = this.store.effectiveStatus(userId)) {
    this.emitter.toCompany(companyId, WS.PRESENCE_UPDATED, {
      userId,
      status,
      lastSeenAt: new Date().toISOString(),
    });
  }

  private broadcastCount(companyId: string) {
    this.emitter.toCompany(companyId, WS.PRESENCE_ONLINE_COUNT, { count: this.onlineCount(companyId) });
  }

  private broadcastUserToActiveCompanies(userId: string, fallbackCompanyId?: string) {
    const companyIds = new Set<string>();
    for (const context of this.socketContexts.values()) {
      if (context.userId === userId) companyIds.add(context.companyId);
    }
    if (fallbackCompanyId) companyIds.add(fallbackCompanyId);
    for (const companyId of companyIds) this.broadcastUser(userId, companyId);
  }

  private hasCompanyConnection(userId: string, companyId: string) {
    for (const context of this.socketContexts.values()) {
      if (context.userId === userId && context.companyId === companyId) return true;
    }
    return false;
  }
}
