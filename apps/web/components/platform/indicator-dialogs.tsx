'use client';

/**
 * Diálogos de gestão do indicador (cadastro, resumo, metas, realizado e
 * histórico) compartilhados pela LISTA (/indicators) e pelo DETALHE
 * (/indicators/[id]). Vieram da página de lista: manter duas cópias faria a
 * mesma ação divergir dependendo da tela em que o usuário estivesse.
 */

import { useEffect, useState } from 'react';
import type * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessageSquare, Paperclip, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/platform/empty-state';
import { LoadingState } from '@/components/platform/loading-state';
import { IndicatorResultEditor, ResultNotesDialog } from '@/components/platform/indicator-result-editor';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import {
  PERIODICITY_LABEL,
  DIRECTION_LABEL,
  INDICATOR_TYPE_LABEL,
  INDICATOR_UNIT_LABEL,
  INDICATOR_STATUS_LABEL,
} from '@/lib/labels';

const TYPE_LABEL = INDICATOR_TYPE_LABEL;
const UNIT_LABEL = INDICATOR_UNIT_LABEL;
const STATUS_LABEL = INDICATOR_STATUS_LABEL;

export interface IndicatorCompanyOption {
  id: string;
  name: string;
  tradeName: string | null;
}

export interface IndicatorOrgNodeOption {
  id: string;
  companyId: string;
  parentId: string | null;
  name: string;
  code: string | null;
  type: string;
  responsibleUserId: string | null;
  parent?: { id: string; name: string; type: string; parentId: string | null } | null;
  _count?: { children: number; indicatorsOwned: number };
}

export interface IndicatorUserOption {
  id: string;
  name: string;
  email?: string;
}

export interface IndicatorObjectiveOption {
  id: string;
  name: string;
  perspective: { id: string; name: string; color: string | null };
  map: { id: string; name: string };
}

export interface IndicatorOptions {
  companies: IndicatorCompanyOption[];
  orgNodes: IndicatorOrgNodeOption[];
  users: IndicatorUserOption[];
  strategicObjectives: IndicatorObjectiveOption[];
  currentPeriod: { year: number; startsAt: string; endsAt: string };
  indicatorTypes: string[];
  units: string[];
  periodicities: string[];
  directions: string[];
  statuses: string[];
}

export interface IndicatorMonthlyPoint {
  periodRef: string;
  month: string;
  meta: number | null;
  target: number | null;
  secondaryTarget: number | null;
  gainLower: number | null;
  gainUpper: number | null;
  realizado: number | null;
  value: number | null;
  attainment: number | null;
  status: string;
}

export interface IndicatorRow {
  id: string;
  companyId: string;
  name: string;
  code: string | null;
  description: string | null;
  type: string;
  category: string | null;
  unit: string;
  unitLabel: string | null;
  periodicity: string;
  direction: string;
  accumulation?: string | null;
  formula: string | null;
  source: string | null;
  formTemplateId?: string | null;
  status: string;
  weight: number;
  yellowToleranceP: number;
  createdAt: string;
  updatedAt: string;
  company: IndicatorCompanyOption;
  ownerNode: { id: string; name: string; type: string; parentId: string | null; parent?: { id: string; name: string; type: string } | null };
  guidelineNode: { id: string; name: string; type: string } | null;
  strategicObjective: IndicatorObjectiveOption | null;
  responsibleUser: { id: string; name: string } | null;
  areaMacro: { id: string; name: string; type: string | null };
  areaMicro: { id: string; name: string; type: string | null } | null;
  /** Áreas participantes: o indicador é compartilhado com elas (a dona é ownerNode). */
  sharedAreas?: Array<{ id: string; name: string; type?: string | null; parentId?: string | null }> | null;
  parentIndicator: { id: string; name: string; code: string | null } | null;
  isMacro: boolean;
  currentTarget: { periodRef: string; target: number; lowerBound: number | null; upperBound: number | null } | null;
  last: {
    id: string;
    periodRef: string;
    value: number;
    light: string;
    attainment: number | null;
    deviationPct: number | null;
    note: string | null;
    updatedAt: string;
  } | null;
  monthlyHistory: IndicatorMonthlyPoint[];
  _count: { actions: number; meetings: number; targets: number; results: number };
}

export interface IndicatorAuditLogRow {
  id: string;
  action: string;
  recordLabel: string | null;
  beforeValue: string | null;
  afterValue: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

export interface IndicatorHistory {
  logs: IndicatorAuditLogRow[];
}

export type IndicatorForm = {
  id: string;
  companyId: string;
  areaMacroId: string;
  areaMicroId: string;
  ownerNodeId: string;
  guidelineNodeId: string;
  strategicObjectiveId: string;
  responsibleUserId: string;
  parentIndicatorId: string;
  name: string;
  code: string;
  description: string;
  type: string;
  category: string;
  unit: string;
  unitLabel: string;
  periodicity: string;
  direction: string;
  accumulation: string;
  formula: string;
  source: string;
  /** Formulário/checklist cujas inspeções alimentam este indicador. */
  formTemplateId: string;
  status: string;
  weight: string;
  yellowToleranceP: string;
  initialTarget: string;
  initialResult: string;
  /**
   * Áreas participantes (compartilhamento). A área dona continua sendo
   * área/setor acima; estas apenas passam a ver o mesmo indicador no Painel
   * Executivo e na Reunião Mensal.
   */
  sharedAreaIds: string[];
};

export const EMPTY_INDICATOR_FORM: IndicatorForm = {
  id: '',
  companyId: '',
  areaMacroId: '',
  areaMicroId: '',
  ownerNodeId: '',
  guidelineNodeId: '',
  strategicObjectiveId: '',
  responsibleUserId: '',
  parentIndicatorId: '',
  name: '',
  code: '',
  description: '',
  type: 'OPERATIONAL',
  category: '',
  unit: 'PERCENT',
  unitLabel: '',
  periodicity: 'MONTHLY',
  direction: 'HIGHER_BETTER',
  accumulation: 'AVERAGE',
  formula: '',
  source: '',
  formTemplateId: '',
  status: 'ACTIVE',
  weight: '1',
  yellowToleranceP: '10',
  initialTarget: '',
  initialResult: '',
  sharedAreaIds: [],
};

/** Preenche o formulário de edição a partir do indicador (lista ou detalhe). */
export function indicatorFormFromRow(indicator: IndicatorRow): IndicatorForm {
  return {
    ...EMPTY_INDICATOR_FORM,
    id: indicator.id,
    companyId: indicator.companyId,
    areaMacroId: indicator.areaMacro?.id ?? '',
    areaMicroId: indicator.areaMicro?.id ?? '',
    ownerNodeId: indicator.ownerNode.id,
    guidelineNodeId: indicator.guidelineNode?.id ?? '',
    strategicObjectiveId: indicator.strategicObjective?.id ?? '',
    responsibleUserId: indicator.responsibleUser?.id ?? '',
    parentIndicatorId: indicator.parentIndicator?.id ?? '',
    name: indicator.name,
    code: indicator.code ?? '',
    description: indicator.description ?? '',
    type: indicator.type,
    category: indicator.category ?? '',
    unit: indicator.unit,
    unitLabel: indicator.unitLabel ?? '',
    periodicity: indicator.periodicity,
    direction: indicator.direction,
    accumulation: indicator.accumulation ?? 'AVERAGE',
    formula: indicator.formula ?? '',
    source: indicator.source ?? '',
    formTemplateId: indicator.formTemplateId ?? '',
    status: indicator.status,
    weight: String(indicator.weight ?? 1),
    yellowToleranceP: String(indicator.yellowToleranceP ?? 10),
    sharedAreaIds: (indicator.sharedAreas ?? []).map((area) => area.id),
  };
}

/**
 * Valida e monta o payload de gravação do indicador. Fica aqui (e não na
 * página) porque tanto a lista quanto o detalhe salvam o mesmo cadastro.
 */
export function buildIndicatorPayload(form: IndicatorForm, fallbackCompanyId?: string) {
  const ownerNodeId = form.areaMicroId || form.areaMacroId || form.ownerNodeId;
  if (!form.name.trim()) throw new Error('Informe o nome do indicador');
  if (!ownerNodeId) throw new Error('Selecione a área ou setor');
  if (!form.unit) throw new Error('Selecione a unidade de medida');
  if (!form.periodicity) throw new Error('Selecione a periodicidade');
  return {
    companyId: form.companyId || fallbackCompanyId,
    ownerNodeId,
    guidelineNodeId: form.guidelineNodeId || null,
    strategicObjectiveId: form.strategicObjectiveId || null,
    responsibleUserId: form.responsibleUserId || null,
    parentIndicatorId: form.parentIndicatorId || null,
    name: form.name,
    code: form.code || null,
    description: form.description || null,
    type: form.type,
    category: form.category || null,
    unit: form.unit,
    unitLabel: form.unitLabel || null,
    periodicity: form.periodicity,
    direction: form.direction,
    accumulation: form.accumulation,
    formula: form.formula || null,
    source: form.source || null,
    formTemplateId: form.formTemplateId || null,
    status: form.status,
    // Compartilhamento: a área dona nunca entra na lista (ela já é dona).
    sharedAreaIds: (form.sharedAreaIds ?? []).filter(
      (id) => id && id !== (form.areaMicroId || form.areaMacroId || form.ownerNodeId),
    ),
    weight: numberOrUndefined(form.weight),
    yellowToleranceP: numberOrUndefined(form.yellowToleranceP),
    initialTarget: form.id ? undefined : numberOrUndefined(form.initialTarget),
    initialResult: form.id ? undefined : numberOrUndefined(form.initialResult),
  };
}

export interface GrainCell {
  periodRef: string;
  target: number | null;
  secondaryTarget?: number | null;
  gainLower?: number | null;
  gainUpper?: number | null;
  value: number | null;
  status: string;
  light: string;
  isClosed?: boolean;
}

export interface GrainResponse {
  indicator: { id: string; name: string };
  granularity: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  monthRef: string;
  cells: GrainCell[];
}

export function grainPeriodLabel(periodRef: string): string {
  // DAILY: 2026-05-15 -> 15
  if (/^\d{4}-\d{2}-\d{2}$/.test(periodRef)) {
    return periodRef.slice(8, 10);
  }
  // WEEKLY: 2026-W21 -> S21
  const wMatch = /^\d{4}-W(\d{2})$/.exec(periodRef);
  if (wMatch) return `S${wMatch[1]}`;
  // BIWEEKLY: 2026-BW3 -> Q3
  const bwMatch = /^\d{4}-BW(\d+)$/.exec(periodRef);
  if (bwMatch) return `Q${bwMatch[1]}`;
  return periodRef;
}

export function currentMonthRef(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function monthOptionsForYear(year: number): { value: string; label: string }[] {
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const pad = (n: number) => String(n).padStart(2, '0');
  return monthNames.map((label, i) => ({
    value: `${year}-${pad(i + 1)}`,
    label: `${label}/${String(year).slice(2)}`,
  }));
}

export function IndicatorFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  companies,
  macroOptions,
  microOptions,
  guidelineOptions,
  areaOptions = [],
  users,
  strategicObjectives,
  parentIndicatorOptions,
  options,
  isSaving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: IndicatorForm;
  setForm: React.Dispatch<React.SetStateAction<IndicatorForm>>;
  companies: IndicatorCompanyOption[];
  macroOptions: IndicatorOrgNodeOption[];
  microOptions: IndicatorOrgNodeOption[];
  guidelineOptions: IndicatorOrgNodeOption[];
  /** Todas as áreas/setores da empresa — base do compartilhamento entre áreas. */
  areaOptions?: IndicatorOrgNodeOption[];
  users: IndicatorUserOption[];
  strategicObjectives: IndicatorObjectiveOption[];
  parentIndicatorOptions: Array<{ id: string; name: string; code: string | null }>;
  options?: IndicatorOptions;
  isSaving: boolean;
  onSave: () => void;
}) {
  // Formulários disponíveis para alimentar o indicador automaticamente.
  // Não dá para filtrar por um status só: um formulário aceita preenchimento
  // quando está PUBLISHED, APPROVED **ou** ACTIVE — pedir `?status=ACTIVE`
  // deixava a lista vazia justamente para os formulários publicados.
  const formTemplatesQuery = useQuery<Array<{ id: string; title: string; version: string | null; status: string }>>({
    queryKey: ['indicator-form-templates'],
    queryFn: () => api('/forms'),
    staleTime: 5 * 60 * 1000,
    select: (rows) => rows.filter((row) => ['PUBLISHED', 'APPROVED', 'ACTIVE'].includes(row.status)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Editar indicador' : 'Incluir indicador'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Nome do indicador" required className="xl:col-span-2">
            <Input value={form.name} onChange={(e) => patchForm(setForm, { name: e.target.value })} placeholder="Ex.: Absenteismo" />
          </Field>
          <Field label="Código">
            <Input value={form.code} onChange={(e) => patchForm(setForm, { code: e.target.value })} placeholder="Ex.: RH-001" />
          </Field>
          <Field label="Empresa" required>
            <NativeSelect value={form.companyId} onChange={(e) => patchForm(setForm, { companyId: e.target.value, areaMacroId: '', areaMicroId: '', guidelineNodeId: '' })}>
              <option value="">Selecione</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.tradeName || company.name}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Área" required>
            <NativeSelect value={form.areaMacroId} onChange={(e) => patchForm(setForm, { areaMacroId: e.target.value, areaMicroId: '' })}>
              <option value="">Selecione</option>
              {macroOptions.map((node) => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Setor">
            <NativeSelect value={form.areaMicroId} onChange={(e) => patchForm(setForm, { areaMicroId: e.target.value })}>
              <option value="">Usar área</option>
              {microOptions.map((node) => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </NativeSelect>
          </Field>
          {/* Indicador compartilhado: mesmo número, várias áreas. A dona (área/setor
              acima) lança e apresenta; as participantes só acompanham. */}
          <Field label="Também aparece nas áreas" className="md:col-span-2 xl:col-span-3">
            <SharedAreasPicker
              nodes={areaOptions}
              ownerNodeId={form.areaMicroId || form.areaMacroId || form.ownerNodeId}
              value={form.sharedAreaIds ?? []}
              onChange={(ids) => patchForm(setForm, { sharedAreaIds: ids })}
            />
          </Field>
          <Field label="Indicador macro (pai)">
            <NativeSelect value={form.parentIndicatorId} onChange={(e) => patchForm(setForm, { parentIndicatorId: e.target.value })}>
              <option value="">Sem vínculo (indicador macro próprio)</option>
              {parentIndicatorOptions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.code ? `${row.code} - ` : ''}{row.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Diretriz vinculada">
            <NativeSelect value={form.guidelineNodeId} onChange={(e) => patchForm(setForm, { guidelineNodeId: e.target.value })}>
              <option value="">Não vinculada</option>
              {guidelineOptions.map((node) => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Objetivo estratégico">
            <NativeSelect value={form.strategicObjectiveId} onChange={(e) => patchForm(setForm, { strategicObjectiveId: e.target.value })}>
              <option value="">Não vinculado</option>
              {strategicObjectives.map((objective) => (
                <option key={objective.id} value={objective.id}>{objective.perspective.name} - {objective.name}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Responsável">
            <NativeSelect value={form.responsibleUserId} onChange={(e) => patchForm(setForm, { responsibleUserId: e.target.value })}>
              <option value="">Sem responsável</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Tipo">
            <NativeSelect value={form.type} onChange={(e) => patchForm(setForm, { type: e.target.value })}>
              {options?.indicatorTypes.map((type) => (
                <option key={type} value={type}>{TYPE_LABEL[type] ?? type}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Unidade" required>
            <NativeSelect value={form.unit} onChange={(e) => patchForm(setForm, { unit: e.target.value })}>
              {options?.units.map((unit) => (
                <option key={unit} value={unit}>{UNIT_LABEL[unit] ?? unit}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Rótulo da unidade">
            <Input value={form.unitLabel} onChange={(e) => patchForm(setForm, { unitLabel: e.target.value })} placeholder="Ex.: R$/t" />
          </Field>
          <Field label="Periodicidade" required>
            <NativeSelect value={form.periodicity} onChange={(e) => patchForm(setForm, { periodicity: e.target.value })}>
              {options?.periodicities.map((periodicity) => (
                <option key={periodicity} value={periodicity}>{PERIODICITY_LABEL[periodicity] ?? periodicity}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Sentido do indicador">
            <NativeSelect value={form.direction} onChange={(e) => patchForm(setForm, { direction: e.target.value })}>
              {options?.directions.map((direction) => (
                <option key={direction} value={direction}>{DIRECTION_LABEL[direction] ?? direction}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Cálculo do acumulado (YTD)">
            <NativeSelect value={form.accumulation} onChange={(e) => patchForm(setForm, { accumulation: e.target.value })}>
              <option value="AVERAGE">Média do ano até o mês (padrão)</option>
              <option value="SUM">Soma mês a mês (ex.: entrada de cana, volumes)</option>
              <option value="FIXED">Fixo — não acumula (usa o valor do mês)</option>
            </NativeSelect>
          </Field>
          <Field label="Status">
            <NativeSelect value={form.status} onChange={(e) => patchForm(setForm, { status: e.target.value })}>
              {options?.statuses.map((status) => (
                <option key={status} value={status}>{STATUS_LABEL[status] ?? status}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Peso">
            <Input type="number" step="0.1" value={form.weight} onChange={(e) => patchForm(setForm, { weight: e.target.value })} />
          </Field>
          <Field label="Tolerância amarela (%)">
            <Input type="number" step="0.1" value={form.yellowToleranceP} onChange={(e) => patchForm(setForm, { yellowToleranceP: e.target.value })} />
          </Field>
          {!form.id && (
            <>
              <Field label="Meta inicial">
                <Input type="number" step="0.01" value={form.initialTarget} onChange={(e) => patchForm(setForm, { initialTarget: e.target.value })} />
              </Field>
              <Field label="Realizado inicial">
                <Input type="number" step="0.01" value={form.initialResult} onChange={(e) => patchForm(setForm, { initialResult: e.target.value })} />
              </Field>
            </>
          )}
          <Field label="Fonte dos dados">
            <Input value={form.source} onChange={(e) => patchForm(setForm, { source: e.target.value })} placeholder="ERP, planilha, sistema interno" />
          </Field>
          {/* Vínculo direto formulário → indicador. (área, setor) não basta:
              um setor pode ter vários indicadores diferentes. */}
          <Field label="Alimentado pelo formulário" className="md:col-span-2">
            <NativeSelect value={form.formTemplateId} onChange={(e) => patchForm(setForm, { formTemplateId: e.target.value })}>
              <option value="">Lançamento manual (sem formulário)</option>
              {(formTemplatesQuery.data ?? []).map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}{template.version ? ` - rev ${template.version}` : ''}
                </option>
              ))}
            </NativeSelect>
            <p className="mt-1 text-xs text-muted-foreground">
              {formTemplatesQuery.data?.length === 0
                ? 'Nenhum formulário publicado ainda. Publique o modelo em Formulários e Checklists para poder vinculá-lo aqui.'
                : 'Ao concluir uma inspeção deste formulário nesta área/setor, o sistema lança a média de conformidade do mês neste indicador.'}
            </p>
          </Field>
          <Field label="Formula de cálculo" className="md:col-span-2">
            <Input value={form.formula} onChange={(e) => patchForm(setForm, { formula: e.target.value })} placeholder="Ex.: (faltas / horas previstas) * 100" />
          </Field>
          <Field label="Categoria">
            <Input value={form.category} onChange={(e) => patchForm(setForm, { category: e.target.value })} placeholder="Opcional" />
          </Field>
          <Field label="Descrição e observações" className="md:col-span-2 xl:col-span-3">
            <Textarea rows={3} value={form.description} onChange={(e) => patchForm(setForm, { description: e.target.value })} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar indicador'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Seleção das áreas participantes. Lista área (macro) com seus setores
 * indentados; a área dona fica de fora — ela já responde pelo indicador.
 */
function SharedAreasPicker({
  nodes,
  ownerNodeId,
  value,
  onChange,
}: {
  nodes: IndicatorOrgNodeOption[];
  ownerNodeId: string;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState('');

  const selected = new Set(value);
  const term = search.trim().toLowerCase();
  const roots = nodes.filter((node) => !node.parentId);
  const childrenOf = (parentId: string) => nodes.filter((node) => node.parentId === parentId);
  // Um setor filtrado pela busca continua visível mesmo que a área pai não case.
  const matches = (node: IndicatorOrgNodeOption) => !term || node.name.toLowerCase().includes(term);
  const rows: Array<{ node: IndicatorOrgNodeOption; depth: number }> = [];
  for (const root of roots) {
    const kids = childrenOf(root.id).filter(matches);
    if (matches(root) || kids.length) rows.push({ node: root, depth: 0 });
    for (const kid of kids) rows.push({ node: kid, depth: 1 });
  }
  // Nós órfãos (sem pai carregado) não podem sumir da lista.
  for (const node of nodes) {
    if (!node.parentId) continue;
    if (roots.some((root) => root.id === node.parentId)) continue;
    if (matches(node)) rows.push({ node, depth: 0 });
  }

  const toggle = (id: string) => {
    onChange(selected.has(id) ? value.filter((item) => item !== id) : [...value, id]);
  };

  if (!nodes.length) {
    return <p className="text-xs text-muted-foreground">Nenhuma área disponível para compartilhar.</p>;
  }

  return (
    <div className="rounded-md border p-2">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar área ou setor..."
          className="h-8 max-w-xs text-sm"
        />
        <span className="text-xs text-muted-foreground">
          {value.length === 0 ? 'Somente a área dona' : `${value.length} área(s) participante(s)`}
        </span>
        {value.length > 0 && (
          <button type="button" className="text-xs text-muted-foreground underline" onClick={() => onChange([])}>
            limpar
          </button>
        )}
      </div>
      <div className="max-h-44 overflow-y-auto pr-1">
        {rows.map(({ node, depth }) => {
          const isOwner = node.id === ownerNodeId;
          return (
            <label
              key={node.id}
              className={cn(
                'flex items-center gap-2 rounded px-1.5 py-1 text-sm',
                isOwner ? 'text-muted-foreground' : 'cursor-pointer hover:bg-accent/40',
                depth === 1 && 'ml-5',
              )}
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5"
                checked={isOwner || selected.has(node.id)}
                disabled={isOwner}
                onChange={() => toggle(node.id)}
              />
              <span className={cn(depth === 0 && 'font-medium')}>{node.name}</span>
              {isOwner && <span className="text-[11px] uppercase tracking-wide">área dona</span>}
            </label>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        O lançamento do realizado e a apresentação continuam com a área dona. As participantes veem o mesmo
        indicador no Painel Executivo e o preparam na Reunião Mensal com análise própria.
      </p>
    </div>
  );
}

export function IndicatorViewDialog({
  indicator,
  onOpenChange,
  showDetailLink = true,
}: {
  indicator: IndicatorRow | null;
  onOpenChange: (open: boolean) => void;
  /** No próprio detalhe o link "Abrir detalhe completo" seria um caminho para a mesma tela. */
  showDetailLink?: boolean;
}) {
  return (
    <Dialog open={Boolean(indicator)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{indicator?.name}</DialogTitle>
        </DialogHeader>
        {indicator && (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <Info label="Empresa" value={indicator.company.tradeName || indicator.company.name} />
              <Info label="Área" value={indicator.areaMacro?.name} />
              <Info label="Setor" value={indicator.areaMicro?.name ?? indicator.ownerNode.name} />
              <Info label="Diretriz" value={indicator.guidelineNode?.name ?? '-'} />
              <Info label="Objetivo estratégico" value={indicator.strategicObjective?.name ?? '-'} />
              <Info label="Responsável" value={indicator.responsibleUser?.name ?? 'Sem responsável'} />
              <Info label="Periodicidade" value={PERIODICITY_LABEL[indicator.periodicity] ?? indicator.periodicity} />
              <Info label="Sentido" value={DIRECTION_LABEL[indicator.direction] ?? indicator.direction} />
              <Info label="Status" value={STATUS_LABEL[indicator.status] ?? indicator.status} />
              {(indicator.sharedAreas?.length ?? 0) > 0 && (
                <Info
                  label="Compartilhado com"
                  value={(indicator.sharedAreas ?? []).map((area) => area.name).join(', ')}
                />
              )}
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold">Dados relacionados</h3>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
                <Info label="Metas" value={formatNumber(indicator._count.targets)} />
                <Info label="Realizados" value={formatNumber(indicator._count.results)} />
                <Info label="Planos de ação" value={formatNumber(indicator._count.actions)} />
                <Info label="Reuniões" value={formatNumber(indicator._count.meetings)} />
              </div>
            </div>
            {indicator.description && <p className="text-sm text-muted-foreground">{indicator.description}</p>}
            {showDetailLink && (
              <div className="flex justify-end">
                <Button variant="outline" asChild>
                  <Link href={`/indicators/${indicator.id}`}>Abrir detalhe completo</Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type LaunchGranularity = 'MONTHLY' | 'WEEKLY' | 'DAILY';

export function IndicatorTargetDialog({
  indicator,
  onOpenChange,
}: {
  indicator: IndicatorRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <UnifiedLaunchDialog
      indicator={indicator}
      mode="target"
      onOpenChange={onOpenChange}
    />
  );
}

export function IndicatorResultDialog({
  indicator,
  onOpenChange,
}: {
  indicator: IndicatorRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <UnifiedLaunchDialog
      indicator={indicator}
      mode="result"
      onOpenChange={onOpenChange}
    />
  );
}

function UnifiedLaunchDialog({
  indicator,
  mode,
  onOpenChange,
}: {
  indicator: IndicatorRow | null;
  mode: 'result' | 'target';
  onOpenChange: (open: boolean) => void;
}) {
  const [granularity, setGranularity] = useState<LaunchGranularity>('MONTHLY');

  useEffect(() => {
    if (indicator) setGranularity('MONTHLY');
  }, [indicator?.id]);

  const isResult = mode === 'result';
  const monthlyLabel = isResult ? 'Lançar Realizado' : 'Meta Mensal';
  const weeklyLabel = isResult ? 'Lançar Semanal' : 'Meta Semanal';
  const dailyLabel = isResult ? 'Lançar Diário' : 'Meta Diária';
  const title = isResult ? `Lançar Realizado · ${indicator?.name ?? ''}` : `Alterar metas · ${indicator?.name ?? ''}`;

  const tabs: Array<{ key: LaunchGranularity; label: string }> = [
    { key: 'MONTHLY', label: monthlyLabel },
    { key: 'WEEKLY', label: weeklyLabel },
    { key: 'DAILY', label: dailyLabel },
  ];

  return (
    <Dialog open={Boolean(indicator)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {indicator && (
          <div className="space-y-4">
            <div className="inline-flex border border-border/60 bg-muted/40 p-0.5">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setGranularity(tab.key)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-colors',
                    granularity === tab.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {granularity === 'MONTHLY' && (
              <IndicatorResultEditor
                mode={mode}
                indicatorId={indicator.id}
                fallbackName={indicator.name}
                unitLabel={indicator.unitLabel ?? indicator.unit}
                // Aberto pelo detalhe, o lançamento tem de refletir no gráfico e
                // nos KPIs da própria tela, não só na lista de indicadores.
                invalidateKeys={[['indicator', indicator.id]]}
              />
            )}
            {granularity !== 'MONTHLY' && (
              <GrainEditor
                indicator={indicator}
                mode={mode}
                granularity={granularity}
              />
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GrainEditor({
  indicator,
  mode,
  granularity,
}: {
  indicator: IndicatorRow;
  mode: 'result' | 'target';
  granularity: 'WEEKLY' | 'DAILY';
}) {
  const qc = useQueryClient();
  const [month, setMonth] = useState<string>(currentMonthRef());
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [notesCell, setNotesCell] = useState<string | null>(null);

  useEffect(() => {
    setEdits({});
    setNotesCell(null);
  }, [indicator.id, granularity, month]);

  const query = useQuery<GrainResponse>({
    queryKey: ['grain', indicator.id, granularity, month],
    queryFn: () => api<GrainResponse>(`/results/grain?indicatorId=${indicator.id}&granularity=${granularity}&month=${month}`),
  });

  const save = useMutation({
    mutationFn: () => {
      const items: { indicatorId: string; periodRef: string; value: number }[] = [];
      for (const [periodRef, raw] of Object.entries(edits)) {
        const trimmed = raw.trim().replace(',', '.');
        if (trimmed === '') continue;
        const num = Number(trimmed);
        if (!Number.isFinite(num)) continue;
        items.push({ indicatorId: indicator.id, periodRef, value: num });
      }
      if (items.length === 0) return Promise.reject(new Error('Nada para salvar'));
      const endpoint = mode === 'target' ? '/results/batch' : '/results/batch';
      return api<{ count: number }>(endpoint, { method: 'POST', json: { items } });
    },
    onSuccess: (out) => {
      toast.success(`${out.count} lançamento(s) salvos`);
      setEdits({});
      qc.invalidateQueries({ queryKey: ['grain', indicator.id] });
      qc.invalidateQueries({ queryKey: ['indicators'] });
      qc.invalidateQueries({ queryKey: ['indicator', indicator.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar'),
  });

  const cells = query.data?.cells ?? [];
  const editedCount = Object.values(edits).filter((v) => v.trim() !== '').length;
  const valueColLabel = mode === 'target' ? 'Meta' : 'Realizado';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-xs uppercase text-muted-foreground">Mês</Label>
        <NativeSelect value={month} onChange={(e) => { setMonth(e.target.value); setEdits({}); }} className="h-9 w-40">
          {monthOptionsForYear(new Date().getFullYear()).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </NativeSelect>
        <span className="text-xs text-muted-foreground">
          {granularity === 'WEEKLY' ? `${cells.length} semana(s) no mês` : `${cells.length} dia(s) no mês`}
        </span>
      </div>

      {query.isLoading && <LoadingState className="min-h-40" />}
      {!query.isLoading && cells.length === 0 && (
        <EmptyState title="Sem períodos" description="Selecione outro mês." />
      )}
      {!query.isLoading && cells.length > 0 && (
        <div className="overflow-x-auto border">
          <table className="table-modern min-w-[480px]">
            <thead>
              <tr>
                <th className="text-left">{granularity === 'WEEKLY' ? 'Semana' : 'Dia'}</th>
                <th className="text-left">Meta</th>
                <th className="text-left">{valueColLabel}</th>
                {mode === 'result' && <th className="text-left">Registros</th>}
              </tr>
            </thead>
            <tbody>
              {cells.map((cell) => {
                const editVal = edits[cell.periodRef] ?? '';
                const persisted = mode === 'target' ? cell.target : cell.value;
                const display = editVal !== ''
                  ? editVal
                  : persisted !== null && persisted !== undefined ? String(persisted) : '';
                return (
                  <tr key={cell.periodRef}>
                    <td>
                      <div className="font-medium">{grainPeriodLabel(cell.periodRef)}</div>
                      <div className="text-xs text-muted-foreground">{cell.periodRef}</div>
                    </td>
                    <td>
                      <div className="text-sm">{cell.target !== null ? formatNumber(cell.target) : '-'}</div>
                    </td>
                    <td>
                      <Input
                        value={display}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [cell.periodRef]: e.target.value }))}
                        placeholder={cell.target !== null ? String(cell.target) : '-'}
                        className="h-9 w-32 text-sm"
                      />
                    </td>
                    {mode === 'result' && (
                      <td>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => setNotesCell(cell.periodRef)}
                            title="Anexos"
                          >
                            <Paperclip className="mr-1 h-3.5 w-3.5" />
                            Anexo
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => setNotesCell(cell.periodRef)}
                            title="Comentários"
                          >
                            <MessageSquare className="mr-1 h-3.5 w-3.5" />
                            Comentários
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={editedCount === 0 || save.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {save.isPending ? 'Salvando...' : `Salvar (${editedCount})`}
        </Button>
      </div>

      {notesCell && (
        <ResultNotesDialog
          indicatorId={indicator.id}
          periodRef={notesCell}
          open={!!notesCell}
          onClose={() => setNotesCell(null)}
        />
      )}
    </div>
  );
}

export function IndicatorHistoryDialog({
  indicator,
  history,
  isLoading,
  onOpenChange,
}: {
  indicator: IndicatorRow | null;
  history?: IndicatorHistory;
  isLoading: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(indicator)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Histórico do indicador</DialogTitle>
        </DialogHeader>
        {isLoading && <LoadingState />}
        {!isLoading && (history?.logs.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum registro de auditoria encontrado para este indicador.</p>
        )}
        <div className="max-h-[55vh] space-y-3 overflow-y-auto">
          {history?.logs.map((log) => (
            <div key={log.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{historyActionLabel(log.action)}</div>
                <div className="text-xs text-muted-foreground">{formatDate(log.createdAt)} - {log.user?.name ?? 'Sistema'}</div>
              </div>
              {log.recordLabel && <p className="mt-1 text-sm text-muted-foreground">{log.recordLabel}</p>}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className={required ? 'field-required' : undefined}>{label}</Label>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value || '-'}</div>
    </div>
  );
}

function patchForm(setForm: React.Dispatch<React.SetStateAction<IndicatorForm>>, patch: Partial<IndicatorForm>) {
  setForm((prev) => ({ ...prev, ...patch }));
}

function numberOrUndefined(value: string) {
  if (!value.trim()) return undefined;
  return Number(value.replace(',', '.'));
}

function historyActionLabel(action: string) {
  const labels: Record<string, string> = {
    CREATE: 'Criação do indicador',
    UPDATE: 'Edição cadastral',
    DELETE: 'Exclusão lógica',
    CREATE_TARGET: 'Meta criada',
    UPDATE_TARGET: 'Meta alterada',
    CREATE_RESULT: 'Realizado lancado',
    UPDATE_RESULT: 'Realizado alterado',
  };
  return labels[action] ?? action;
}
