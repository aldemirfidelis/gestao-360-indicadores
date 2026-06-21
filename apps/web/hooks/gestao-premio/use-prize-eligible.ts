import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface PrizeCompetenceRef {
  id: string;
  label: string;
  program: { code: string; name: string };
}

interface PrizeEligibleEmployee {
  id: string;
  registration: string;
  name: string;
  cpfMasked: string | null;
  positionRef: string | null;
  areaRef: string | null;
  costCenterRef: string | null;
  situation: string;
  workedDays: number | null;
  eligible: boolean;
  blocked: boolean;
  lotVersion: number;
  events: number;
  baseSalary: number | null;
}

interface PrizeEligibleSnapshot {
  canSeeSalary: boolean;
  total: number;
  employees: PrizeEligibleEmployee[];
}

export interface PrizeEligibleReconciliation {
  added: string[];
  removed: string[];
  changed: any[];
  unchanged: number;
  flags: {
    missingSalary: string[];
    missingPosition: string[];
    terminated: string[];
  };
}

export interface PrizeEligibleIssue {
  row: number;
  column?: string;
  message: string;
}

export interface PrizeEligibleFilePayload {
  fileName: string;
  rawRows?: Record<string, unknown>[];
  rawEvents?: Record<string, unknown>[];
  xlsxBase64?: string;
}

export interface PrizeEligibleImportPreview {
  fileName: string | null;
  mode: 'FULL_IMPORT' | 'EVENTS_APPEND';
  eligible: {
    total: number;
    ok: number;
    errors: PrizeEligibleIssue[];
    warnings: PrizeEligibleIssue[];
    unknownColumns: string[];
  };
  events: {
    total: number;
    ok: number;
    errors: PrizeEligibleIssue[];
    warnings: PrizeEligibleIssue[];
    unknownColumns: string[];
  };
  reconciliation: PrizeEligibleReconciliation | null;
  canCommit: boolean;
}

export interface PrizeEligibleAtestadoPreview {
  fileName: string | null;
  total: number;
  ok: number;
  employeesAffected: number;
  errors: PrizeEligibleIssue[];
  warnings: PrizeEligibleIssue[];
  unknownColumns: string[];
  perEmployee: { registration: string; occurrences: number; totalDays: number }[];
  canCommit: boolean;
}

interface PrizeEligibleRecon {
  job: { lotVersion: number; processed: number; createdAt: string } | null;
  reconciliation: PrizeEligibleReconciliation | null;
}

export function usePrizeEligibleData(competenceId: string) {
  const queryClient = useQueryClient();

  const competencesQuery = useQuery({
    queryKey: ['prize-competences-ref'],
    queryFn: () => api<PrizeCompetenceRef[]>('/prize/competences'),
  });

  const snapshotQuery = useQuery({
    queryKey: ['prize-eligible', competenceId],
    queryFn: () => api<PrizeEligibleSnapshot>(`/prize/eligible/competence/${competenceId}`),
    enabled: !!competenceId,
  });

  const reconciliationQuery = useQuery({
    queryKey: ['prize-eligible-recon', competenceId],
    queryFn: () => api<PrizeEligibleRecon>(`/prize/eligible/competence/${competenceId}/reconciliation`),
    enabled: !!competenceId,
  });

  const invalidateEligible = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['prize-eligible'] });
    queryClient.invalidateQueries({ queryKey: ['prize-eligible-recon'] });
  }, [queryClient]);

  return {
    competences: competencesQuery.data ?? [],
    isCompetencesLoading: competencesQuery.isLoading,
    snapshot: snapshotQuery.data,
    isSnapshotLoading: snapshotQuery.isLoading,
    snapshotError: snapshotQuery.error,
    recon: reconciliationQuery.data,
    isReconLoading: reconciliationQuery.isLoading,
    invalidateEligible,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

interface UsePrizeEligibleImportActionsParams {
  competenceId: string;
  payload: PrizeEligibleFilePayload | null;
  atestadoPayload: PrizeEligibleFilePayload | null;
  invalidateEligible: () => void;
  onPreview: (preview: PrizeEligibleImportPreview | null) => void;
  onAtestadoPreview: (preview: PrizeEligibleAtestadoPreview | null) => void;
  onImportCommitted: () => void;
  onAtestadosCommitted: () => void;
}

export function usePrizeEligibleImportActions({
  competenceId,
  payload,
  atestadoPayload,
  invalidateEligible,
  onPreview,
  onAtestadoPreview,
  onImportCommitted,
  onAtestadosCommitted,
}: UsePrizeEligibleImportActionsParams) {
  const importMock = useMutation({
    mutationFn: () =>
      api(`/prize/eligible/competence/${competenceId}/import`, {
        method: 'POST',
        json: { source: 'MANUAL', useMock: true, mockCount: 12 },
      }),
    onSuccess: (result: any) => {
      const reconciliation = result.reconciliation;
      toast.success(
        `Lote ${result.job.lotVersion} importado: ${result.job.processed} colaborador(es) · +${reconciliation.added.length}/-${reconciliation.removed.length}/~${reconciliation.changed.length}`,
      );
      invalidateEligible();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const previewMut = useMutation({
    mutationFn: (nextPayload: PrizeEligibleFilePayload) =>
      api<PrizeEligibleImportPreview>(`/prize/eligible/competence/${competenceId}/import/preview`, {
        method: 'POST',
        json: nextPayload,
      }),
    onSuccess: (output) => {
      onPreview(output);
      if (output.canCommit) {
        toast.success(`Prévia ok: ${output.eligible.ok} colaborador(es), ${output.events.ok} evento(s) - pronto para importar`);
      } else {
        toast.error(`Arquivo com ${output.eligible.errors.length + output.events.errors.length} erro(s) - corrija e reenvie`);
      }
    },
    onError: (error) => {
      onPreview(null);
      toast.error(getErrorMessage(error));
    },
  });

  const commitMut = useMutation({
    mutationFn: () =>
      api(`/prize/eligible/competence/${competenceId}/import/file`, {
        method: 'POST',
        json: payload,
      }),
    onSuccess: (result: any) => {
      toast.success(
        result.job
          ? `Lote ${result.job.lotVersion} importado (${result.job.processed} colaboradores)`
          : `${result.created} evento(s) registrados`,
      );
      invalidateEligible();
      onImportCommitted();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const atestadoPreviewMut = useMutation({
    mutationFn: (nextPayload: PrizeEligibleFilePayload) =>
      api<PrizeEligibleAtestadoPreview>(`/prize/eligible/competence/${competenceId}/atestados/preview`, {
        method: 'POST',
        json: nextPayload,
      }),
    onSuccess: (output) => {
      onAtestadoPreview(output);
      if (output.canCommit) {
        toast.success(`Prévia ok: ${output.ok} atestado(s) em ${output.employeesAffected} colaborador(es)`);
      } else {
        toast.error(`Arquivo com ${output.errors.length} erro(s) - corrija e reenvie`);
      }
    },
    onError: (error) => {
      onAtestadoPreview(null);
      toast.error(getErrorMessage(error));
    },
  });

  const atestadoCommitMut = useMutation({
    mutationFn: () =>
      api<{ created: number; deleted: number; employeesAffected: number }>(
        `/prize/eligible/competence/${competenceId}/atestados/file`,
        {
          method: 'POST',
          json: atestadoPayload,
        },
      ),
    onSuccess: (result) => {
      toast.success(
        `${result.created} atestado(s) importados em ${result.employeesAffected} colaborador(es)${
          result.deleted ? ` (substituiu ${result.deleted} anterior(es))` : ''
        }`,
      );
      invalidateEligible();
      onAtestadosCommitted();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return {
    importMock,
    previewMut,
    commitMut,
    atestadoPreviewMut,
    atestadoCommitMut,
  };
}
