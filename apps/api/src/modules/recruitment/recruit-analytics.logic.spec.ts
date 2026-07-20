import { describe, expect, it } from 'vitest';
import { average, buildFunnelByStageType, countStale, diffDays, groupCount } from './recruit-analytics.logic';

describe('recruit-analytics.logic', () => {
  it('diffDays calcula a diferença absoluta em dias', () => {
    const a = new Date('2026-01-10T00:00:00Z');
    const b = new Date('2026-01-15T00:00:00Z');
    expect(diffDays(a, b)).toBe(5);
    expect(diffDays(b, a)).toBe(5);
  });

  it('average retorna null para lista vazia e a média arredondada em uma casa', () => {
    expect(average([])).toBeNull();
    expect(average([1, 2, 3])).toBe(2);
    expect(average([1, 2])).toBe(1.5);
  });

  it('buildFunnelByStageType agrupa por tipo na ordem canônica e isola nulos em SEM_ETAPA', () => {
    const result = buildFunnelByStageType([
      { stageType: 'INTERVIEW' },
      { stageType: 'STANDARD' },
      { stageType: 'STANDARD' },
      { stageType: null },
      { stageType: 'TIPO_DESCONHECIDO' },
    ]);
    expect(result).toEqual([
      { stageType: 'STANDARD', count: 2 },
      { stageType: 'INTERVIEW', count: 1 },
      { stageType: 'SEM_ETAPA', count: 2 }, // null + tipo desconhecido caem juntos
    ]);
  });

  it('groupCount agrupa e ordena por contagem decrescente', () => {
    const result = groupCount(['CARREIRAS', 'INDICACAO', 'CARREIRAS', 'CARREIRAS'], (x) => x);
    expect(result).toEqual([
      { key: 'CARREIRAS', count: 3 },
      { key: 'INDICACAO', count: 1 },
    ]);
  });

  it('groupCount trata chave vazia como OUTROS', () => {
    const result = groupCount([{ v: '' }, { v: '' }], (x) => x.v);
    expect(result).toEqual([{ key: 'OUTROS', count: 2 }]);
  });

  it('countStale usa o limite do item ou o padrão quando ausente', () => {
    const now = new Date('2026-02-01T00:00:00Z');
    const items = [
      { referenceDate: new Date('2026-01-01T00:00:00Z'), limitDays: 20 }, // 31 dias > 20 -> stale
      { referenceDate: new Date('2026-01-25T00:00:00Z'), limitDays: 20 }, // 7 dias -> ok
      { referenceDate: new Date('2026-01-01T00:00:00Z'), limitDays: null }, // 31 dias > padrão(30) -> stale
    ];
    expect(countStale(items, now, 30)).toBe(2);
  });
});
