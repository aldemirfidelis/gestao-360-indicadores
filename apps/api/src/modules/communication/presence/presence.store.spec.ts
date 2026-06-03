import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PresenceStatus } from '@prisma/client';
import { InMemoryPresenceStore } from './presence.store';

describe('InMemoryPresenceStore', () => {
  let store: InMemoryPresenceStore;
  beforeEach(() => {
    store = new InMemoryPresenceStore();
  });

  it('primeira conexão fica ONLINE e marca firstConnection', () => {
    const r = store.addConnection('u1', 's1');
    expect(r.firstConnection).toBe(true);
    expect(store.effectiveStatus('u1')).toBe(PresenceStatus.ONLINE);
    expect(store.onlineCount()).toBe(1);
  });

  it('múltiplas abas: 2ª conexão não é firstConnection; sair de 1 mantém online', () => {
    store.addConnection('u1', 's1');
    const second = store.addConnection('u1', 's2');
    expect(second.firstConnection).toBe(false);
    const rem = store.removeConnection('u1', 's1');
    expect(rem.lastConnection).toBe(false);
    expect(store.effectiveStatus('u1')).toBe(PresenceStatus.ONLINE);
  });

  it('última desconexão fica OFFLINE e limpa status manual', () => {
    store.addConnection('u1', 's1');
    store.setManualStatus('u1', PresenceStatus.BUSY);
    const rem = store.removeConnection('u1', 's1');
    expect(rem.lastConnection).toBe(true);
    expect(store.effectiveStatus('u1')).toBe(PresenceStatus.OFFLINE);
    expect(store.onlineCount()).toBe(0);
  });

  it('inatividade (markActivity false) => AWAY; atividade => ONLINE', () => {
    store.addConnection('u1', 's1');
    store.markActivity('u1', false);
    expect(store.effectiveStatus('u1')).toBe(PresenceStatus.AWAY);
    store.markActivity('u1', true);
    expect(store.effectiveStatus('u1')).toBe(PresenceStatus.ONLINE);
  });

  it('status manual tem precedência sobre o automático', () => {
    store.addConnection('u1', 's1');
    store.setManualStatus('u1', PresenceStatus.DND);
    store.markActivity('u1', true); // mesmo ativo, mantém DND
    expect(store.effectiveStatus('u1')).toBe(PresenceStatus.DND);
    store.setManualStatus('u1', PresenceStatus.OFFLINE); // OFFLINE => limpa manual
    expect(store.effectiveStatus('u1')).toBe(PresenceStatus.ONLINE);
  });

  it('sweepIdle marca AWAY quem está ocioso e respeita status manual', () => {
    store.addConnection('u1', 's1');
    store.addConnection('u2', 's2');
    store.setManualStatus('u2', PresenceStatus.BUSY);
    // simula u1 ocioso há 10min
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 10 * 60_000);
    const flipped = store.sweepIdle(5 * 60_000);
    vi.restoreAllMocks();
    expect(flipped).toContain('u1');
    expect(flipped).not.toContain('u2'); // manual BUSY preservado
    expect(store.effectiveStatus('u1')).toBe(PresenceStatus.AWAY);
    expect(store.effectiveStatus('u2')).toBe(PresenceStatus.BUSY);
  });

  it('snapshotFor retorna OFFLINE para desconhecidos e status vivo para online', () => {
    store.addConnection('u1', 's1');
    const snap = store.snapshotFor(['u1', 'ghost']);
    expect(snap.u1.status).toBe(PresenceStatus.ONLINE);
    expect(snap.ghost.status).toBe(PresenceStatus.OFFLINE);
  });
});
