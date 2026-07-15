import { describe, expect, it } from 'vitest';
import { answerPasses, evaluateScreening, fallbackTriage, weightedAverage } from './recruit-triage.logic';

describe('recruit-triage.logic', () => {
  it('avalia respostas eliminatorias e obrigatorias sem decidir por IA', () => {
    const result = evaluateScreening(
      [
        { id: 'q1', type: 'YES_NO', question: 'Tem CNH?', required: true, knockout: true, desiredAnswer: true, weight: 2 },
        { id: 'q2', type: 'TEXT', question: 'Resumo', required: true },
      ],
      [{ questionId: 'q1', answer: false }],
    );
    expect(result.requiredMissing).toEqual(['q2']);
    expect(result.knockoutFailed).toEqual(['q1']);
    expect(result.score).toBe(0);
  });

  it('compara respostas por tipo', () => {
    expect(answerPasses('SINGLE_CHOICE', 'Remoto', 'remoto')).toBe(true);
    expect(answerPasses('MULTI_CHOICE', ['React', 'Node'], ['node'])).toBe(true);
    expect(answerPasses('NUMBER', 4, { min: 3 })).toBe(true);
    expect(answerPasses('TEXT', 'qualquer coisa', null)).toBeNull();
  });

  it('calcula media ponderada do scorecard', () => {
    expect(weightedAverage([{ score: 5, weight: 2 }, { score: 3, weight: 1 }])).toBe(4.3);
    expect(weightedAverage([])).toBeNull();
  });

  it('gera triagem deterministica explicavel', () => {
    const triage = fallbackTriage({
      vacancyTitle: 'Analista de Dados',
      requirements: 'SQL, Power BI, Python e comunicacao',
      candidateText: 'Experiencia com SQL e Python em projetos de dados.',
    });
    expect(triage.summary).toContain('Analista de Dados');
    expect(triage.evidence.some((item) => item.term === 'sql')).toBe(true);
    expect(triage.missingRequirements.some((item) => item.term === 'power')).toBe(true);
    expect(triage.confidence).toBeGreaterThan(0);
  });
});
