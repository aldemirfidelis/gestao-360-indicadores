import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';

export interface CompetenceRef { id: string; label: string; program: { code: string; name: string } }
export interface Run {
  id: string; version: number; status: string; totalEmployees: number; totalGross: string | null;
  totalReductions: string | null; totalFinal: string | null; engineVersion: string; finishedAt: string | null;
}
export interface Result {
  id: string; registration: string; name: string; potential: string | null; weightedGain: string | null;
  proportionality: string | null; grossValue: string | null; totalReductions: string | null; adjustments: string | null;
  gratification: string | null; finalValue: string | null; blocked: boolean; blockReason: string | null; exceptionType: string | null; hash: string | null;
}
export interface MemoryLine { id: string; step: number; code: string; label: string; detail: string | null; value: string | null }
export interface Memory extends Result { lines: MemoryLine[] }
export interface CellResult {
  id: string; areaRef: string; positionRef: string; possibleSalaryPercent: string; achievedSalaryPercent: string;
  weightedGainPercent: string | null; status: string; group?: { name: string };
}
export interface UnmatchedEmployee { id: string; registration: string; name: string; areaRef: string | null; positionRef: string | null; reason: string }

/**
 * Camada de dados da Apuracao Mensal (Gestao de Premio): centraliza as queries
 * (competencias, resultados, regua coletiva v2, nao casados, memoria) e as
 * mutacoes (apurar, apurar v2, reprocessar, conferencia, automatizar) com cache.
 */
export function usePrizeApuracao(competenceId: string, memoryFor: string | null) {
  const qc = useQueryClient();

  const competencesQuery = useQuery({
    queryKey: ['prize-competences-ref'],
    queryFn: () => api<CompetenceRef[]>('/prize/competences'),
  });
  const resultsQuery = useQuery({
    queryKey: ['prize-calc-results', competenceId],
    queryFn: () => api<{ run: Run | null; results: Result[]; competenceStatus: string | null }>(`/prize/calc/competence/${competenceId}/results`),
    enabled: !!competenceId,
  });
  const cellsQuery = useQuery({
    queryKey: ['prize-v2-cells', competenceId],
    queryFn: () => api<{ run: Run | null; cells: CellResult[] }>(`/prize/rules/competence/${competenceId}/cells`),
    enabled: !!competenceId,
  });
  const unmatchedQuery = useQuery({
    queryKey: ['prize-v2-unmatched', competenceId],
    queryFn: () => api<{ run: Run | null; unmatched: UnmatchedEmployee[] }>(`/prize/rules/competence/${competenceId}/unmatched`),
    enabled: !!competenceId,
  });
  const memoryQuery = useQuery({
    queryKey: ['prize-calc-memory', memoryFor],
    queryFn: () => api<Memory>(`/prize/calc/result/${memoryFor}/memory`),
    enabled: !!memoryFor,
  });

  const invalidateResults = () => qc.invalidateQueries({ queryKey: ['prize-calc-results'] });

  const run = useMutation({
    mutationFn: () => api(`/prize/calc/competence/${competenceId}/run`, { method: 'POST' }),
    onSuccess: (r: any) => { toast.success(`Apuração v${r.version} concluída: ${r.totalEmployees} colaborador(es)`); invalidateResults(); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const runV2 = useMutation({
    mutationFn: () => api<any>(`/prize/calc/competence/${competenceId}/run-v2`, { method: 'POST' }),
    onSuccess: (r) => {
      if (r.blockedReason) toast.warning(`V2 bloqueada: ${r.blockedReason}`);
      else {
        const apurados = r.apurados ?? r.totalEmployees ?? 0;
        const fora = r.outOfScope ?? 0;
        toast.success(fora > 0
          ? `Setor apurado na v2: ${apurados} apurado(s); ${fora} fora do escopo (sem regra) — veja "Não casados".`
          : `Setor apurado na v2: ${apurados} colaborador(es)`);
      }
      qc.invalidateQueries({ queryKey: ['prize-calc-results'] });
      qc.invalidateQueries({ queryKey: ['prize-v2-cells'] });
      qc.invalidateQueries({ queryKey: ['prize-v2-unmatched'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const reprocess = useMutation({
    mutationFn: (reason: string) => api(`/prize/calc/competence/${competenceId}/reprocess`, { method: 'POST', json: { reason } }),
    onSuccess: (r: any) => { toast.success(`Reprocessado (v${r.version})`); invalidateResults(); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const conference = useMutation({
    mutationFn: ({ action, comment }: { action: string; comment?: string }) =>
      api(`/prize/calc/competence/${competenceId}/${action}`, { method: 'POST', json: comment ? { comment } : {} }),
    onSuccess: () => { toast.success('Conferência atualizada'); invalidateResults(); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const autopilot = useMutation({
    mutationFn: () => api<any>(`/prize/competences/${competenceId}/autopilot`, { method: 'POST', json: { runCalc: true } }),
    onSuccess: (r) => {
      const s = r.sync;
      if (r.calcRun) toast.success(`Automatização: ${s.synced} realizado(s) sincronizado(s) · apuração v${r.calcRun.version} concluída (${r.calcRun.totalEmployees} colab.)`);
      else toast.warning(`Automatização: ${s.synced} sincronizado(s), apuração não rodou — ${r.calcSkipped ?? 'verifique a lista de verificação'}`);
      invalidateResults();
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  return {
    competences: competencesQuery.data ?? [],
    data: resultsQuery.data,
    isLoading: resultsQuery.isLoading,
    cellData: cellsQuery.data,
    unmatchedData: unmatchedQuery.data,
    memory: memoryQuery.data,
    run,
    runV2,
    reprocess,
    conference,
    autopilot,
  };
}
