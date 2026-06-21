import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface CompensationOptions {
  jobs: Array<{ id: string; name: string; orgJobId?: string | null }>;
}

interface CompensationStructure {
  employees: Array<{ id: string; name: string; registrationId: string | null; band: string }>;
}

interface ApprovalStep {
  role: string;
  status: string;
  approverId?: string;
}

interface Movement {
  id: string;
  protocol: string;
  type: string;
  monthlyImpact: string | null;
  currentSalary: string | null;
  proposedSalary: string | null;
  effectiveAt: string;
  status: string;
  reason: string;
  createdAt: string;
  approvalSteps?: ApprovalStep[] | null;
}

export function useCompensationMovements() {
  const queryClient = useQueryClient();

  const optionsQuery = useQuery<CompensationOptions>({
    queryKey: ['compensation', 'options'],
    queryFn: () => api('/cargos-salarios/options'),
  });

  const structureQuery = useQuery<CompensationStructure>({
    queryKey: ['compensation', 'estrutura-quadro'],
    queryFn: () => api('/cargos-salarios/estrutura-quadro'),
  });

  const movementsQuery = useQuery<Movement[]>({
    queryKey: ['compensation', 'movements'],
    queryFn: () => api('/cargos-salarios/movements'),
  });

  const invalidateMovements = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['compensation', 'movements'] });
    queryClient.invalidateQueries({ queryKey: ['compensation', 'approvals'] });
  }, [queryClient]);

  return {
    optionsQuery,
    structureQuery,
    movementsQuery,
    invalidateMovements,
  };
}
