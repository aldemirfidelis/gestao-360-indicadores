import { PresenceStatus } from '@prisma/client';

/**
 * Estado de presença de um usuário mantido em memória de processo.
 * `manualStatus` é o que o usuário escolheu (Ocupado/Não perturbe/Ausente);
 * `auto` reflete atividade (ONLINE quando há conexão ativa, AWAY quando ocioso).
 * O status efetivo combina os dois (manual tem precedência, exceto OFFLINE).
 */
export interface PresenceRecord {
  sockets: Set<string>;
  manualStatus: PresenceStatus | null;
  auto: PresenceStatus;
  lastSeenAt: Date;
  lastActiveAt: Date;
}

export interface PresenceSnapshot {
  userId: string;
  status: PresenceStatus;
  lastSeenAt: Date | null;
}

/**
 * Abstração do armazenamento de presença. A implementação atual é em memória
 * (single-instance). Para escalar horizontalmente (múltiplas instâncias da API),
 * troca-se por uma implementação baseada em Redis (ver docs/realtime-architecture.md)
 * sem alterar o restante do código — basta prover outro `PRESENCE_STORE`.
 */
export abstract class PresenceStore {
  /** Registra um socket; retorna se foi a primeira conexão do usuário. */
  abstract addConnection(userId: string, socketId: string): { firstConnection: boolean };
  /** Remove um socket; retorna se foi a última conexão (usuário ficou offline). */
  abstract removeConnection(userId: string, socketId: string): { lastConnection: boolean };
  abstract setManualStatus(userId: string, status: PresenceStatus | null): void;
  abstract markActivity(userId: string, active: boolean): void;
  abstract touch(userId: string): void;
  abstract effectiveStatus(userId: string): PresenceStatus;
  abstract onlineUserIds(): string[];
  abstract onlineCount(): number;
  abstract snapshotFor(userIds: string[]): Record<string, PresenceSnapshot>;
  /** Marca como AWAY quem está ocioso há mais de `awayMs`; retorna userIds afetados. */
  abstract sweepIdle(awayMs: number): string[];
}

const OFFLINE = PresenceStatus.OFFLINE;

export class InMemoryPresenceStore extends PresenceStore {
  private readonly records = new Map<string, PresenceRecord>();

  private ensure(userId: string): PresenceRecord {
    let rec = this.records.get(userId);
    if (!rec) {
      rec = {
        sockets: new Set(),
        manualStatus: null,
        auto: OFFLINE,
        lastSeenAt: new Date(),
        lastActiveAt: new Date(),
      };
      this.records.set(userId, rec);
    }
    return rec;
  }

  addConnection(userId: string, socketId: string): { firstConnection: boolean } {
    const rec = this.ensure(userId);
    const firstConnection = rec.sockets.size === 0;
    rec.sockets.add(socketId);
    rec.auto = PresenceStatus.ONLINE;
    rec.lastSeenAt = new Date();
    rec.lastActiveAt = new Date();
    return { firstConnection };
  }

  removeConnection(userId: string, socketId: string): { lastConnection: boolean } {
    const rec = this.records.get(userId);
    if (!rec) return { lastConnection: false };
    rec.sockets.delete(socketId);
    rec.lastSeenAt = new Date();
    const lastConnection = rec.sockets.size === 0;
    if (lastConnection) {
      rec.auto = OFFLINE;
      rec.manualStatus = null; // status manual não persiste após sair
    }
    return { lastConnection };
  }

  setManualStatus(userId: string, status: PresenceStatus | null): void {
    const rec = this.ensure(userId);
    rec.manualStatus = status && status !== OFFLINE ? status : null;
    rec.lastSeenAt = new Date();
  }

  markActivity(userId: string, active: boolean): void {
    const rec = this.records.get(userId);
    if (!rec || rec.sockets.size === 0) return;
    rec.lastSeenAt = new Date();
    if (active) {
      rec.lastActiveAt = new Date();
      rec.auto = PresenceStatus.ONLINE;
    } else {
      rec.auto = PresenceStatus.AWAY;
    }
  }

  touch(userId: string): void {
    const rec = this.records.get(userId);
    if (rec) rec.lastSeenAt = new Date();
  }

  effectiveStatus(userId: string): PresenceStatus {
    const rec = this.records.get(userId);
    if (!rec || rec.sockets.size === 0) return OFFLINE;
    return rec.manualStatus ?? rec.auto;
  }

  onlineUserIds(): string[] {
    const ids: string[] = [];
    for (const [userId, rec] of this.records) {
      if (rec.sockets.size > 0) ids.push(userId);
    }
    return ids;
  }

  onlineCount(): number {
    let count = 0;
    for (const rec of this.records.values()) if (rec.sockets.size > 0) count += 1;
    return count;
  }

  snapshotFor(userIds: string[]): Record<string, PresenceSnapshot> {
    const out: Record<string, PresenceSnapshot> = {};
    for (const userId of userIds) {
      const rec = this.records.get(userId);
      out[userId] = {
        userId,
        status: rec && rec.sockets.size > 0 ? rec.manualStatus ?? rec.auto : OFFLINE,
        lastSeenAt: rec?.lastSeenAt ?? null,
      };
    }
    return out;
  }

  sweepIdle(awayMs: number): string[] {
    const now = Date.now();
    const flipped: string[] = [];
    for (const [userId, rec] of this.records) {
      if (rec.sockets.size === 0) continue;
      if (rec.manualStatus) continue; // respeita escolha manual
      if (rec.auto === PresenceStatus.ONLINE && now - rec.lastActiveAt.getTime() > awayMs) {
        rec.auto = PresenceStatus.AWAY;
        flipped.push(userId);
      }
    }
    return flipped;
  }
}

export const PRESENCE_STORE = Symbol('PRESENCE_STORE');
