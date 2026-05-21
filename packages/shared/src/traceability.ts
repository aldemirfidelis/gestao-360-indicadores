export interface TraceabilitySignals {
  hasOffTargetResult: boolean;
  hasOpenDeviation: boolean;
  hasCauseAnalysis: boolean;
  hasMeeting: boolean;
  hasOpenAction: boolean;
  hasCompletedAction: boolean;
  hasEvidence: boolean;
  indicatorBackInGoal: boolean;
}

export function traceabilityNextSteps(signals: TraceabilitySignals): string[] {
  const steps: string[] = [];

  if (signals.hasOffTargetResult && !signals.hasOpenDeviation) {
    steps.push('Criar analise de causa para o indicador fora da meta.');
  }
  if (signals.hasOpenDeviation && !signals.hasCauseAnalysis) {
    steps.push('Registrar causa provavel, causa raiz e evidencias da analise.');
  }
  if (signals.hasCauseAnalysis && !signals.hasMeeting) {
    steps.push('Registrar reuniao ou decisao formal para tratar a causa raiz.');
  }
  if ((signals.hasCauseAnalysis || signals.hasMeeting) && !signals.hasOpenAction && !signals.hasCompletedAction) {
    steps.push('Criar plano de acao com responsavel, prazo e resultado esperado.');
  }
  if (signals.hasOpenAction && !signals.hasEvidence) {
    steps.push('Solicitar evidencia de execucao antes da conclusao.');
  }
  if (signals.hasCompletedAction && !signals.indicatorBackInGoal) {
    steps.push('Reavaliar o indicador apos a acao concluida.');
  }
  if (signals.hasCompletedAction && signals.indicatorBackInGoal) {
    steps.push('Concluir o caso e manter o historico para auditoria.');
  }

  return steps;
}

export interface TreatmentFlowSignals {
  hasCauseAnalysis: boolean;
  hasMeeting: boolean;
  actionCount: number;
  overdueActionCount: number;
  actionsWithoutResponsible: number;
  actionsWithoutDeadline: number;
  invalidParticipantEmails: number;
  completedActionWithoutEvidence: boolean;
  indicatorStillOffTargetAfterActions: boolean;
}

export function treatmentFlowAlerts(signals: TreatmentFlowSignals): string[] {
  const alerts: string[] = [];

  if (!signals.hasCauseAnalysis) alerts.push('Indicador fora da meta sem analise de causa.');
  if (signals.hasCauseAnalysis && !signals.hasMeeting) alerts.push('Analise criada sem reuniao de tratativa.');
  if (signals.hasMeeting && signals.actionCount === 0) alerts.push('Reuniao agendada sem plano de acao.');
  if (signals.actionsWithoutResponsible > 0) alerts.push('Existem acoes sem responsavel.');
  if (signals.actionsWithoutDeadline > 0) alerts.push('Existem acoes sem prazo definido.');
  if (signals.overdueActionCount > 0) alerts.push('Existem acoes atrasadas.');
  if (signals.invalidParticipantEmails > 0) alerts.push('Existem participantes com e-mail invalido.');
  if (signals.completedActionWithoutEvidence) alerts.push('Acao concluida sem evidencia vinculada.');
  if (signals.indicatorStillOffTargetAfterActions) alerts.push('Indicador continua fora da meta apos acao concluida.');

  return alerts;
}
