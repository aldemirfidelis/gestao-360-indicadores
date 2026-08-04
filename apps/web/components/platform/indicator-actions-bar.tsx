'use client';

/**
 * Barra de gestão do indicador — os MESMOS botões da tela de Indicadores
 * (Lançar Realizado, Visualizar, Editar, Metas, Histórico, Inativar) para que o
 * usuário resolva tudo de onde estiver, sem voltar para a lista. Usa os
 * diálogos compartilhados de `indicator-dialogs` (fonte única do comportamento).
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays, Eye, History, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImpactConfirmationModal } from '@/components/ui/impact-confirmation-modal';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  EMPTY_INDICATOR_FORM,
  IndicatorFormDialog,
  IndicatorHistoryDialog,
  IndicatorResultDialog,
  IndicatorTargetDialog,
  IndicatorViewDialog,
  buildIndicatorPayload,
  indicatorFormFromRow,
  type IndicatorForm,
  type IndicatorHistory,
  type IndicatorOptions,
  type IndicatorRow,
} from '@/components/platform/indicator-dialogs';

/**
 * O que GET /indicators/:id devolve e a barra consome. É um subconjunto do
 * detalhe: o restante (série, desvios, planos) é assunto da tela, não daqui.
 */
interface IndicatorDetailPayload {
  id: string;
  companyId: string;
  name: string;
  code: string | null;
  description: string | null;
  type: string;
  category?: string | null;
  unit: string;
  unitLabel: string | null;
  periodicity: string;
  direction: string;
  accumulation?: string | null;
  formula?: string | null;
  source?: string | null;
  formTemplateId?: string | null;
  status: string;
  weight?: number;
  yellowToleranceP?: number;
  createdAt?: string;
  updatedAt?: string;
  company?: { id: string; name: string; tradeName?: string | null } | null;
  ownerNode: { id: string; name: string; type: string; parentId?: string | null; parent?: { id: string; name: string; type: string } | null };
  guidelineNode?: { id: string; name: string; type: string } | null;
  strategicObjective?: any;
  responsibleUser?: { id: string; name: string } | null;
  areaMacro?: { id: string; name: string; type: string | null } | null;
  areaMicro?: { id: string; name: string; type: string | null } | null;
  sharedAreas?: Array<{ id: string; name: string; type?: string | null; parentId?: string | null }> | null;
  parentIndicator?: { id: string; name: string; code: string | null } | null;
  isMacro?: boolean;
  _count?: { actions: number; meetings: number; targets: number; results: number };
  /** Visibilidade RESUMIDA: o backend devolve uma projeção sem o cadastro. */
  summary?: boolean;
}

/** Adapta o detalhe ao formato que os diálogos compartilhados esperam. */
function toIndicatorRow(detail: IndicatorDetailPayload): IndicatorRow {
  return {
    id: detail.id,
    companyId: detail.companyId,
    name: detail.name,
    code: detail.code,
    description: detail.description,
    type: detail.type,
    category: detail.category ?? null,
    unit: detail.unit,
    unitLabel: detail.unitLabel,
    periodicity: detail.periodicity,
    direction: detail.direction,
    accumulation: detail.accumulation ?? null,
    formula: detail.formula ?? null,
    source: detail.source ?? null,
    formTemplateId: detail.formTemplateId ?? null,
    status: detail.status,
    weight: detail.weight ?? 1,
    yellowToleranceP: detail.yellowToleranceP ?? 10,
    createdAt: detail.createdAt ?? '',
    updatedAt: detail.updatedAt ?? '',
    company: {
      id: detail.company?.id ?? detail.companyId,
      name: detail.company?.name ?? '',
      tradeName: detail.company?.tradeName ?? null,
    },
    ownerNode: {
      id: detail.ownerNode.id,
      name: detail.ownerNode.name,
      type: detail.ownerNode.type,
      parentId: detail.ownerNode.parentId ?? null,
      parent: detail.ownerNode.parent ?? null,
    },
    guidelineNode: detail.guidelineNode ?? null,
    strategicObjective: detail.strategicObjective ?? null,
    responsibleUser: detail.responsibleUser ?? null,
    areaMacro: detail.areaMacro ?? { id: detail.ownerNode.id, name: detail.ownerNode.name, type: detail.ownerNode.type },
    areaMicro: detail.areaMicro ?? null,
    sharedAreas: detail.sharedAreas ?? [],
    parentIndicator: detail.parentIndicator ?? null,
    isMacro: detail.isMacro ?? false,
    // Campos que só a lista calcula (gráfico e último lançamento) não são usados
    // pelos diálogos; o detalhe já mostra tudo isso na própria tela.
    currentTarget: null,
    last: null,
    monthlyHistory: [],
    _count: detail._count ?? { actions: 0, meetings: 0, targets: 0, results: 0 },
  };
}

export function IndicatorActionsBar({
  indicatorId,
  className,
}: {
  indicatorId: string;
  className?: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(['indicators:update']);
  const canDelete = hasPermission(['indicators:delete']);
  const canTargets = hasPermission(['indicators:targets', 'indicators:update']);
  const canLaunch = hasPermission(['results:launch']);
  const canHistory = hasPermission(['indicators:history', 'indicators:view']);

  const [viewOpen, setViewOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<IndicatorForm>(EMPTY_INDICATOR_FORM);
  const [targetOpen, setTargetOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [impactConfig, setImpactConfig] = useState<{
    operationType: 'UPDATE' | 'DELETE';
    changeSummary: string;
    onConfirm: (payload: { justification: string; affectedItems: any[] }) => void;
  } | null>(null);

  // Mesma queryKey do detalhe: aproveita o cache em vez de repetir a chamada.
  const detail = useQuery<IndicatorDetailPayload>({
    queryKey: ['indicator', indicatorId],
    queryFn: () => api<IndicatorDetailPayload>(`/indicators/${indicatorId}`),
  });

  const options = useQuery<IndicatorOptions>({
    queryKey: ['indicators', 'options'],
    queryFn: () => api<IndicatorOptions>('/indicators/options'),
    staleTime: 5 * 60 * 1000,
  });

  const history = useQuery<IndicatorHistory>({
    queryKey: ['indicators', indicatorId, 'history'],
    enabled: historyOpen,
    queryFn: () => api<IndicatorHistory>(`/indicators/${indicatorId}/history`),
  });

  // Candidatos a indicador macro (pai): só carrega quando o cadastro abre.
  const siblings = useQuery<Array<{ id: string; name: string; code: string | null }>>({
    queryKey: ['indicators', 'parent-options', form.companyId],
    enabled: formOpen && Boolean(form.companyId),
    queryFn: () => api<Array<{ id: string; name: string; code: string | null }>>(`/indicators?companyId=${encodeURIComponent(form.companyId)}`),
  });

  // Em visibilidade RESUMIDA o payload não traz o cadastro (nem ownerNode):
  // não há o que gerenciar, então a barra simplesmente não aparece.
  const row = useMemo(
    () => (detail.data && !detail.data.summary && detail.data.ownerNode ? toIndicatorRow(detail.data) : null),
    [detail.data],
  );

  const orgNodes = options.data?.orgNodes ?? [];
  const formOrgNodes = useMemo(
    () => orgNodes.filter((node) => !form.companyId || node.companyId === form.companyId),
    [orgNodes, form.companyId],
  );
  const macroOptions = useMemo(
    () => formOrgNodes.filter((node) => !node.parentId || (node._count?.children ?? 0) > 0),
    [formOrgNodes],
  );
  const microOptions = useMemo(
    () => formOrgNodes.filter((node) => (form.areaMacroId ? node.parentId === form.areaMacroId : node.parentId)),
    [formOrgNodes, form.areaMacroId],
  );
  const guidelineOptions = useMemo(() => formOrgNodes.filter((node) => node.type === 'DIRECTORATE'), [formOrgNodes]);

  const saveIndicator = useMutation({
    mutationFn: () => {
      const payload = buildIndicatorPayload(form, detail.data?.companyId);
      return api(`/indicators/${form.id}`, { method: 'PATCH', json: payload });
    },
    onSuccess: () => {
      toast.success('Indicador atualizado');
      setFormOpen(false);
      qc.invalidateQueries({ queryKey: ['indicator', indicatorId] });
      qc.invalidateQueries({ queryKey: ['indicators'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Falha ao salvar indicador'),
  });

  const deleteIndicator = useMutation({
    mutationFn: () => api(`/indicators/${indicatorId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Indicador inativado com exclusão lógica');
      qc.invalidateQueries({ queryKey: ['indicators'] });
      // O indicador saiu de operação: a tela de detalhe perde o sentido.
      router.push('/indicators');
    },
    onError: (error: Error) => toast.error(error.message || 'Falha ao inativar indicador'),
  });

  // Edição e inativação passam pela análise de impacto, igual à tela de lista.
  const registerImpact = async (
    operationType: 'UPDATE' | 'DELETE',
    changeSummary: string,
    payload: { justification: string; affectedItems: any[] },
  ) => {
    await api('/vision360/impact-analysis', {
      method: 'POST',
      json: {
        sourceEntityType: 'INDICATOR',
        sourceEntityId: indicatorId,
        operationType,
        changeSummary,
        justification: payload.justification,
        impactLevel: payload.affectedItems.some((i) => i.impactLevel === 'CRITICAL' || i.impactLevel === 'HIGH') ? 'HIGH' : 'MEDIUM',
        affectedItems: payload.affectedItems,
      },
    });
  };

  const handleSave = () => {
    if (!row) return;
    const changeSummary = `Edição cadastral do indicador "${form.name}" (Código: ${form.code || 'sem código'})`;
    setImpactConfig({
      operationType: 'UPDATE',
      changeSummary,
      onConfirm: async (payload) => {
        try {
          await registerImpact('UPDATE', changeSummary, payload);
          saveIndicator.mutate();
          setImpactConfig(null);
        } catch (err: any) {
          toast.error(err?.message || 'Erro ao registrar análise de impacto.');
        }
      },
    });
  };

  const handleDelete = () => {
    if (!row) return;
    const changeSummary = `Exclusão lógica do indicador "${row.name}" (Código: ${row.code || 'sem código'})`;
    setImpactConfig({
      operationType: 'DELETE',
      changeSummary,
      onConfirm: async (payload) => {
        try {
          await registerImpact('DELETE', changeSummary, payload);
          deleteIndicator.mutate();
          setImpactConfig(null);
        } catch (err: any) {
          toast.error(err?.message || 'Erro ao registrar análise de impacto.');
        }
      },
    });
  };

  const openEdit = () => {
    if (!row) return;
    setForm(indicatorFormFromRow(row));
    setFormOpen(true);
  };

  if (!row) return null;

  return (
    <>
      <div className={cn('mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-card/45 p-3 shadow-sm backdrop-blur-sm', className)}>
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gestão do indicador</span>
        {canLaunch && (
          <Button size="sm" onClick={() => setResultOpen(true)}>
            <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
            Lançar Realizado
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setViewOpen(true)}>
          <Eye className="mr-1.5 h-3.5 w-3.5" />
          Visualizar
        </Button>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Editar
          </Button>
        )}
        {canTargets && (
          <Button variant="outline" size="sm" onClick={() => setTargetOpen(true)}>Metas</Button>
        )}
        {canHistory && (
          <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}>
            <History className="mr-1.5 h-3.5 w-3.5" />
            Histórico
          </Button>
        )}
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={deleteIndicator.isPending}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {deleteIndicator.isPending ? 'Inativando...' : 'Inativar'}
          </Button>
        )}
      </div>

      <IndicatorViewDialog
        indicator={viewOpen ? row : null}
        onOpenChange={(open) => !open && setViewOpen(false)}
        showDetailLink={false}
      />

      <IndicatorFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        form={form}
        setForm={setForm}
        companies={options.data?.companies ?? []}
        macroOptions={macroOptions}
        microOptions={microOptions}
        guidelineOptions={guidelineOptions}
        areaOptions={formOrgNodes}
        users={options.data?.users ?? []}
        strategicObjectives={options.data?.strategicObjectives ?? []}
        parentIndicatorOptions={(siblings.data ?? []).filter((item) => item.id !== indicatorId)}
        options={options.data}
        isSaving={saveIndicator.isPending}
        onSave={handleSave}
      />

      <IndicatorTargetDialog
        indicator={targetOpen ? row : null}
        onOpenChange={(open) => !open && setTargetOpen(false)}
      />

      <IndicatorResultDialog
        indicator={resultOpen ? row : null}
        onOpenChange={(open) => !open && setResultOpen(false)}
      />

      <IndicatorHistoryDialog
        indicator={historyOpen ? row : null}
        history={history.data}
        isLoading={history.isLoading}
        onOpenChange={(open) => !open && setHistoryOpen(false)}
      />

      {impactConfig && (
        <ImpactConfirmationModal
          isOpen
          onClose={() => setImpactConfig(null)}
          onConfirm={impactConfig.onConfirm}
          entityType="INDICATOR"
          entityId={indicatorId}
          operationType={impactConfig.operationType}
          changeSummary={impactConfig.changeSummary}
        />
      )}
    </>
  );
}
