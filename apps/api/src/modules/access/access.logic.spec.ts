import { describe, it, expect } from 'vitest';
import { resolveAreaScope, levelForArea, ResolveInput, RuleLite } from './access.logic';

const baseRule = (over: Partial<RuleLite>): RuleLite => ({
  sourceAreaId: 'RH',
  targetAreaId: 'SEG',
  moduleKey: 'indicators',
  visibilityLevel: 'SUMMARY',
  canView: true,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  canApprove: false,
  canExport: false,
  ...over,
});

const base = (over: Partial<ResolveInput> = {}): ResolveInput => ({
  role: 'MANAGER',
  companyWide: false,
  areaAccessEnabled: true,
  ownAreaIds: ['RH'],
  moduleKey: 'indicators',
  action: 'view',
  rules: [],
  exceptions: [],
  ...over,
});

describe('resolveAreaScope', () => {
  it('admin de empresa (companyWide) ⇒ ALL', () => {
    expect(resolveAreaScope(base({ companyWide: true }))).toBe('ALL');
  });

  it('empresa com areaAccessEnabled=false ⇒ ALL', () => {
    expect(resolveAreaScope(base({ areaAccessEnabled: false }))).toBe('ALL');
  });

  it('diretor enxerga tudo em leitura, mas não em escrita', () => {
    expect(resolveAreaScope(base({ role: 'DIRECTOR', action: 'view' }))).toBe('ALL');
    const write = resolveAreaScope(base({ role: 'DIRECTOR', action: 'edit' }));
    expect(write).toEqual(['RH']); // só a própria área para escrever
  });

  it('padrão: usuário vê apenas a própria área', () => {
    expect(resolveAreaScope(base())).toEqual(['RH']);
  });

  it('matriz concede visualização de outra área', () => {
    const scope = resolveAreaScope(base({ rules: [baseRule({ canView: true })] }));
    expect(scope).toContain('RH');
    expect(scope).toContain('SEG');
  });

  it('matriz que concede view NÃO concede edit', () => {
    const scope = resolveAreaScope(base({ action: 'edit', rules: [baseRule({ canView: true, canEdit: false })] }));
    expect(scope).toEqual(['RH']);
  });

  it('exceção ALLOW adiciona área; DENY tem prioridade sobre tudo', () => {
    const allow = resolveAreaScope(base({ exceptions: [{ targetAreaId: 'FIN', moduleKey: 'indicators', effect: 'ALLOW' }] }));
    expect(allow).toContain('FIN');

    const deny = resolveAreaScope(
      base({
        rules: [baseRule({ canView: true })], // matriz concede SEG
        exceptions: [{ targetAreaId: 'SEG', moduleKey: 'indicators', effect: 'DENY' }],
      }),
    );
    expect(deny).not.toContain('SEG');
    expect(deny).toContain('RH');
  });

  it('regra com moduleKey "*" vale para qualquer módulo', () => {
    const scope = resolveAreaScope(base({ moduleKey: 'actions', rules: [baseRule({ moduleKey: '*', canView: true })] }));
    expect(scope).toContain('SEG');
  });
});

describe('levelForArea', () => {
  const lvlBase = (over = {}) => ({
    role: 'MANAGER',
    companyWide: false,
    areaAccessEnabled: true,
    ownAreaIds: ['RH'],
    moduleKey: 'indicators',
    rules: [] as RuleLite[],
    exceptions: [],
    ...over,
  });

  it('própria área ⇒ FULL', () => {
    expect(levelForArea(lvlBase(), 'RH')).toBe('FULL');
  });
  it('área liberada por matriz como SUMMARY ⇒ SUMMARY', () => {
    expect(levelForArea(lvlBase({ rules: [baseRule({ visibilityLevel: 'SUMMARY' })] }), 'SEG')).toBe('SUMMARY');
  });
  it('sem regra ⇒ NONE', () => {
    expect(levelForArea(lvlBase(), 'SEG')).toBe('NONE');
  });
  it('DENY zera o nível mesmo com matriz', () => {
    const lvl = levelForArea(
      lvlBase({ rules: [baseRule({ visibilityLevel: 'FULL' })], exceptions: [{ targetAreaId: 'SEG', moduleKey: 'indicators', effect: 'DENY' }] }),
      'SEG',
    );
    expect(lvl).toBe('NONE');
  });
});
