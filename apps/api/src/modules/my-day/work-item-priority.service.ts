import { Injectable } from '@nestjs/common';
import type { WorkItemPriority } from '@g360/shared';

export interface PriorityInput {
  itemType: string;
  criticality?: string | null; // CRITICAL | HIGH | MEDIUM | LOW
  dueAt?: Date | null;
  isBlocking?: boolean;
  requiresDecision?: boolean;
  now?: Date;
}

export interface PriorityResult {
  priority: WorkItemPriority;
  priorityScore: number;
  priorityReason: string;
  overdueDays: number;
  slaStatus: 'ON_TRACK' | 'DUE_SOON' | 'OVERDUE' | 'NONE';
}

const DAY = 86_400_000;

/**
 * Prioridade inteligente (baseada em regras). Calcula uma pontuacao e uma
 * faixa (crítica/alta/média/baixa/informativa) com a justificativa exibivel.
 * A IA assistiva podera complementar isto numa fase posterior.
 */
@Injectable()
export class WorkItemPriorityService {
  compute(input: PriorityInput): PriorityResult {
    const now = input.now ?? new Date();
    const reasons: string[] = [];
    let score = 0;

    const crit = (input.criticality ?? 'MEDIUM').toUpperCase();
    const base = crit === 'CRITICAL' ? 60 : crit === 'HIGH' ? 40 : crit === 'LOW' ? 10 : 20;
    score += base;
    if (crit === 'CRITICAL') reasons.push('criticidade crítica');
    else if (crit === 'HIGH') reasons.push('criticidade alta');

    let overdueDays = 0;
    let slaStatus: PriorityResult['slaStatus'] = 'NONE';
    if (input.dueAt) {
      const diffDays = Math.ceil((input.dueAt.getTime() - now.getTime()) / DAY);
      if (diffDays < 0) {
        overdueDays = Math.abs(diffDays);
        slaStatus = 'OVERDUE';
        score += Math.min(overdueDays, 30) * 3;
        reasons.push(`atrasado ${overdueDays} dia(s)`);
      } else if (diffDays === 0) {
        slaStatus = 'DUE_SOON';
        score += 25;
        reasons.push('vence hoje');
      } else if (diffDays <= 2) {
        slaStatus = 'DUE_SOON';
        score += 18;
        reasons.push(`vence em ${diffDays} dia(s)`);
      } else if (diffDays <= 7) {
        slaStatus = 'ON_TRACK';
        score += 8;
        reasons.push(`prazo em ${diffDays} dias`);
      } else {
        slaStatus = 'ON_TRACK';
      }
    }

    if (input.isBlocking) {
      score += 20;
      reasons.push('bloqueia outros itens');
    }
    if (input.requiresDecision) {
      score += 10;
      reasons.push('aguarda sua decisão');
    }
    if (input.itemType === 'RISK_CRITICAL') score += 12;
    if (input.itemType === 'APPROVAL') score += 6;

    const priority: WorkItemPriority =
      score >= 80 ? 'CRITICAL' : score >= 55 ? 'HIGH' : score >= 30 ? 'MEDIUM' : score >= 15 ? 'LOW' : 'INFO';

    const priorityReason = reasons.length ? reasons.join('; ') : 'Sem fatores de urgência relevantes';
    return { priority, priorityScore: score, priorityReason, overdueDays, slaStatus };
  }
}
