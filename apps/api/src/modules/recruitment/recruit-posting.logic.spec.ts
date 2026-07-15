import { describe, expect, it } from 'vitest';
import { DEFAULT_PIPELINE_STAGES, isPubliclyVisible, slugify, toPublicVacancy, type PostingLike } from './recruit-posting.logic';

const base: PostingLike = {
  id: 'p1', slug: 'analista-financeiro', title: 'Analista Financeiro',
  publicDescription: 'Descrição pública', publicRequirements: 'Requisitos públicos',
  benefitsText: 'VT, VR', processStepsText: 'Triagem, entrevista', location: 'Matriz', city: 'Goiânia',
  workMode: 'PRESENCIAL', contractType: 'CLT', areaName: 'Financeiro', visibility: 'PUBLIC', pcd: false,
  showSalary: false, salaryText: 'R$ 5.000', status: 'PUBLISHED', publishedAt: new Date('2026-07-01'), closesAt: null,
};

describe('recruit-posting.logic', () => {
  it('slugify normaliza e limita', () => {
    expect(slugify('Analista Financeiro Sênior')).toBe('analista-financeiro-senior');
    expect(slugify('  Vaga @#$ Confidencial! ')).toBe('vaga-confidencial');
    expect(slugify('')).toBe('vaga');
  });

  it('tem etapas padrão de pipeline', () => {
    expect(DEFAULT_PIPELINE_STAGES[0].name).toBe('Candidatura recebida');
    expect(DEFAULT_PIPELINE_STAGES.some((s) => s.type === 'ELIMINATORY')).toBe(true);
    expect(DEFAULT_PIPELINE_STAGES.length).toBeGreaterThanOrEqual(8);
  });

  it('visibilidade pública: publicada, pública e não encerrada', () => {
    expect(isPubliclyVisible(base)).toBe(true);
    expect(isPubliclyVisible({ ...base, status: 'DRAFT' })).toBe(false);
    expect(isPubliclyVisible({ ...base, visibility: 'INTERNAL' })).toBe(false);
    expect(isPubliclyVisible({ ...base, closesAt: new Date('2020-01-01') })).toBe(false);
    expect(isPubliclyVisible({ ...base, visibility: 'BOTH' })).toBe(true);
  });

  it('projeção pública não expõe salário quando showSalary=false', () => {
    const pub = toPublicVacancy(base);
    expect(pub.title).toBe('Analista Financeiro');
    expect(pub.salary).toBeNull();
    expect((pub as any).protectedSnapshot).toBeUndefined();
    expect((pub as any).requisitionId).toBeUndefined();
    const withSalary = toPublicVacancy({ ...base, showSalary: true });
    expect(withSalary.salary).toBe('R$ 5.000');
  });
});
