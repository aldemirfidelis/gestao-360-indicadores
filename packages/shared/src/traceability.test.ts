import { describe, expect, it } from 'vitest';
import { traceabilityNextSteps, treatmentFlowAlerts } from './traceability';

describe('traceabilityNextSteps', () => {
  it('orienta criacao de analise quando indicador fica fora da meta', () => {
    expect(
      traceabilityNextSteps({
        hasOffTargetResult: true,
        hasOpenDeviation: false,
        hasCauseAnalysis: false,
        hasMeeting: false,
        hasOpenAction: false,
        hasCompletedAction: false,
        hasEvidence: false,
        indicatorBackInGoal: false,
      }),
    ).toContain('Criar analise de causa para o indicador fora da meta.');
  });

  it('orienta plano de acao depois de analise sem acao', () => {
    expect(
      traceabilityNextSteps({
        hasOffTargetResult: true,
        hasOpenDeviation: true,
        hasCauseAnalysis: true,
        hasMeeting: false,
        hasOpenAction: false,
        hasCompletedAction: false,
        hasEvidence: false,
        indicatorBackInGoal: false,
      }),
    ).toContain('Criar plano de acao com responsavel, prazo e resultado esperado.');
  });

  it('fecha o ciclo quando acao resolveu o indicador', () => {
    expect(
      traceabilityNextSteps({
        hasOffTargetResult: true,
        hasOpenDeviation: false,
        hasCauseAnalysis: true,
        hasMeeting: true,
        hasOpenAction: false,
        hasCompletedAction: true,
        hasEvidence: true,
        indicatorBackInGoal: true,
      }),
    ).toContain('Concluir o caso e manter o historico para auditoria.');
  });
});

describe('treatmentFlowAlerts', () => {
  it('alerta quando indicador fora da meta nao tem analise', () => {
    expect(
      treatmentFlowAlerts({
        hasCauseAnalysis: false,
        hasMeeting: false,
        actionCount: 0,
        overdueActionCount: 0,
        actionsWithoutResponsible: 0,
        actionsWithoutDeadline: 0,
        invalidParticipantEmails: 0,
        completedActionWithoutEvidence: false,
        indicatorStillOffTargetAfterActions: false,
      }),
    ).toContain('Indicador fora da meta sem analise de causa.');
  });

  it('alerta reuniao sem plano de acao e convites invalidos', () => {
    expect(
      treatmentFlowAlerts({
        hasCauseAnalysis: true,
        hasMeeting: true,
        actionCount: 0,
        overdueActionCount: 0,
        actionsWithoutResponsible: 0,
        actionsWithoutDeadline: 0,
        invalidParticipantEmails: 1,
        completedActionWithoutEvidence: false,
        indicatorStillOffTargetAfterActions: false,
      }),
    ).toEqual(['Reuniao agendada sem plano de acao.', 'Existem participantes com e-mail invalido.']);
  });

  it('alerta reavaliacao nao resolvida depois de acoes', () => {
    expect(
      treatmentFlowAlerts({
        hasCauseAnalysis: true,
        hasMeeting: true,
        actionCount: 2,
        overdueActionCount: 0,
        actionsWithoutResponsible: 0,
        actionsWithoutDeadline: 0,
        invalidParticipantEmails: 0,
        completedActionWithoutEvidence: false,
        indicatorStillOffTargetAfterActions: true,
      }),
    ).toContain('Indicador continua fora da meta apos acao concluida.');
  });
});
