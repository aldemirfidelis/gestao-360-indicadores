import { describe, it, expect } from 'vitest';
import { evaluateFlag, bucket, FlagLike, FlagContext } from './flag-eval';

const base: FlagLike = {
  key: 'enable_x', enabled: true, rolloutPercentage: null,
  allowedRoles: [], allowedUserIds: [], allowedScopes: [], environment: null,
  scheduledOnAt: null, scheduledOffAt: null,
};
const ctx = (over: Partial<FlagContext> = {}): FlagContext => ({ userId: 'u1', role: 'MANAGER', environment: 'production', scopeIds: ['c1', 'u1', 'MANAGER'], ...over });

describe('evaluateFlag', () => {
  it('flag desabilitada => false', () => {
    expect(evaluateFlag({ ...base, enabled: false }, ctx())).toBe(false);
  });

  it('SUPER_ADMIN faz bypass quando habilitada', () => {
    expect(evaluateFlag({ ...base, allowedRoles: ['DIRECTOR'] }, ctx({ role: 'SUPER_ADMIN' }))).toBe(true);
  });

  it('respeita allowedRoles', () => {
    expect(evaluateFlag({ ...base, allowedRoles: ['DIRECTOR'] }, ctx({ role: 'MANAGER' }))).toBe(false);
    expect(evaluateFlag({ ...base, allowedRoles: ['MANAGER'] }, ctx({ role: 'MANAGER' }))).toBe(true);
  });

  it('respeita allowedUserIds e allowedScopes', () => {
    expect(evaluateFlag({ ...base, allowedUserIds: ['u9'] }, ctx())).toBe(false);
    expect(evaluateFlag({ ...base, allowedScopes: ['c9'] }, ctx())).toBe(false);
    expect(evaluateFlag({ ...base, allowedScopes: ['c1'] }, ctx())).toBe(true);
  });

  it('respeita ambiente', () => {
    expect(evaluateFlag({ ...base, environment: 'staging' }, ctx({ environment: 'production' }))).toBe(false);
  });

  it('respeita janela de datas', () => {
    const future = new Date(Date.now() + 86400000);
    const past = new Date(Date.now() - 86400000);
    expect(evaluateFlag({ ...base, scheduledOnAt: future }, ctx())).toBe(false);
    expect(evaluateFlag({ ...base, scheduledOffAt: past }, ctx())).toBe(false);
  });

  it('rollout 0% => false, 100%/null => true', () => {
    expect(evaluateFlag({ ...base, rolloutPercentage: 0 }, ctx())).toBe(false);
    expect(evaluateFlag({ ...base, rolloutPercentage: 100 }, ctx())).toBe(true);
  });

  it('rollout é determinístico por usuário+key', () => {
    const f = { ...base, rolloutPercentage: 50 };
    const a = evaluateFlag(f, ctx({ userId: 'same' }));
    const b = evaluateFlag(f, ctx({ userId: 'same' }));
    expect(a).toBe(b);
    expect(bucket('k:u')).toBeGreaterThanOrEqual(0);
    expect(bucket('k:u')).toBeLessThan(100);
  });
});
