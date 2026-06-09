import { describe, it, expect } from 'vitest';
import { maskCpf, reconcile, generateMockEligible } from './prize-eligible.util';

describe('maskCpf', () => {
  it('mascara preservando os dígitos do meio', () => {
    expect(maskCpf('123.456.789-00')).toBe('***.456.789-**');
    expect(maskCpf('12345678900')).toBe('***.456.789-**');
  });
  it('retorna null para vazio e máscara genérica para inválido', () => {
    expect(maskCpf(null)).toBeNull();
    expect(maskCpf('123')).toBe('***.***.***-**');
  });
});

describe('reconcile', () => {
  const prev = [
    { registration: '1', positionRef: 'Operador I', areaRef: 'Producao', costCenterRef: 'CC-1', situation: 'ACTIVE', baseSalary: 3000 },
    { registration: '2', positionRef: 'Tecnico', areaRef: 'Manutencao', costCenterRef: 'CC-2', situation: 'ACTIVE', baseSalary: 4000 },
  ];

  it('detecta inclusão, exclusão e alteração', () => {
    const incoming = [
      { registration: '1', positionRef: 'Operador II', areaRef: 'Producao', costCenterRef: 'CC-1', situation: 'ACTIVE', baseSalary: 3000 }, // mudou cargo
      { registration: '3', positionRef: 'Analista', areaRef: 'Qualidade', costCenterRef: 'CC-3', situation: 'ACTIVE', baseSalary: 5000 }, // novo
    ];
    const r = reconcile(prev, incoming);
    expect(r.added).toEqual(['3']);
    expect(r.removed).toEqual(['2']);
    expect(r.changed.find((c) => c.registration === '1' && c.field === 'positionRef')).toBeTruthy();
  });

  it('sinaliza pendências (sem salário, sem cargo, desligado)', () => {
    const incoming = [
      { registration: '1', positionRef: null, areaRef: 'Producao', costCenterRef: 'CC-1', situation: 'TERMINATED', baseSalary: null },
    ];
    const r = reconcile(prev, incoming);
    expect(r.flags.missingSalary).toContain('1');
    expect(r.flags.missingPosition).toContain('1');
    expect(r.flags.terminated).toContain('1');
  });

  it('conta inalterados', () => {
    const r = reconcile(prev, prev);
    expect(r.unchanged).toBe(2);
    expect(r.added).toHaveLength(0);
    expect(r.removed).toHaveLength(0);
  });
});

describe('generateMockEligible', () => {
  it('gera base fictícia determinística por seed', () => {
    const a = generateMockEligible(5, 42);
    const b = generateMockEligible(5, 42);
    expect(a).toHaveLength(5);
    expect(a.map((r) => r.name)).toEqual(b.map((r) => r.name));
    expect(a.every((r) => r.registration && r.baseSalary && r.baseSalary > 0)).toBe(true);
  });
});
