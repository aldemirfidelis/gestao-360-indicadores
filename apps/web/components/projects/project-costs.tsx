'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/platform/confirm-dialog';
import { EmptyState } from '@/components/platform/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { downloadCsv } from '@/lib/compensation/format';
import { cn } from '@/lib/utils';
import { IconButton } from './project-schedule';
import {
  COST_KIND_LABEL,
  formatDay,
  formatMoney,
  parseAmount,
  toDateInput,
  todayInput,
  type ProjectCost,
  type ProjectCostKind,
  type ProjectDetail,
} from './types';
import { settle, type ProjectAction } from './use-project';

const EMPTY = { kind: 'ACTUAL' as ProjectCostKind, description: '', category: '', amount: '', date: '', notes: '' };

/** Orçamento do projeto: custos previstos, realizados e saldo. */
export function ProjectCosts({ project, canEdit, action }: { project: ProjectDetail; canEdit: boolean; action: ProjectAction }) {
  const [dialog, setDialog] = useState<{ open: boolean; cost: ProjectCost | null }>({ open: false, cost: null });
  const [toDelete, setToDelete] = useState<ProjectCost | null>(null);
  const [kindFilter, setKindFilter] = useState<'' | ProjectCostKind>('');
  const finance = project.finance;
  const costs = kindFilter ? project.costs.filter((cost) => cost.kind === kindFilter) : project.costs;

  const categories = useMemo(
    () => [...new Set(project.costs.map((cost) => cost.category).filter((category): category is string => Boolean(category)))].sort(),
    [project.costs],
  );
  const byCategory = useMemo(() => {
    const totals = new Map<string, { planned: number; actual: number }>();
    for (const cost of project.costs) {
      const key = cost.category ?? 'Sem categoria';
      const entry = totals.get(key) ?? { planned: 0, actual: 0 };
      if (cost.kind === 'PLANNED') entry.planned += cost.amount;
      else entry.actual += cost.amount;
      totals.set(key, entry);
    }
    return [...totals.entries()].sort((a, b) => b[1].actual + b[1].planned - (a[1].actual + a[1].planned));
  }, [project.costs]);

  function exportCosts() {
    downloadCsv(`custos-${project.code ?? 'projeto'}.csv`, [
      ['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor', 'Observações'],
      ...project.costs.map((cost) => [toDateInput(cost.date), COST_KIND_LABEL[cost.kind], cost.description, cost.category ?? '', cost.amount, cost.notes ?? '']),
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Orçamento aprovado" value={formatMoney(finance.budget)} hint={finance.budget === null ? 'Defina o orçamento em Editar projeto' : undefined} />
        <Stat label="Custo previsto" value={formatMoney(finance.plannedCost)} hint={finance.budget !== null && finance.plannedCost > finance.budget ? 'Previsão acima do orçamento' : undefined} tone={finance.budget !== null && finance.plannedCost > finance.budget ? 'text-status-yellow' : undefined} />
        <Stat label="Custo realizado" value={formatMoney(finance.actualCost)} tone={finance.overBudget ? 'text-status-red' : undefined} hint={finance.consumedPct === null ? undefined : `${finance.consumedPct}% do orçamento`} />
        <Stat label="Saldo" value={formatMoney(finance.balance)} tone={finance.balance !== null && finance.balance < 0 ? 'text-status-red' : 'text-status-green'} hint={finance.overBudget ? 'Orçamento estourado' : undefined} />
      </div>

      {finance.consumedPct !== null && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Consumo do orçamento</span>
            <span className={cn(finance.overBudget && 'font-semibold text-status-red')}>{finance.consumedPct}%</span>
          </div>
          <Progress value={Math.min(100, finance.consumedPct)} />
        </div>
      )}

      {byCategory.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Por categoria</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b text-left text-[11px] uppercase text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Categoria</th>
                    <th className="py-2 pr-3 text-right font-medium">Previsto</th>
                    <th className="py-2 pr-3 text-right font-medium">Realizado</th>
                    <th className="py-2 text-right font-medium">Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {byCategory.map(([category, totals]) => (
                    <tr key={category} className="border-b last:border-0">
                      <td className="py-2 pr-3">{category}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(totals.planned)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(totals.actual)}</td>
                      <td className={cn('py-2 text-right tabular-nums', totals.actual > totals.planned && totals.planned > 0 && 'text-status-red')}>
                        {formatMoney(totals.planned - totals.actual)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle>Lançamentos ({project.costs.length})</CardTitle>
          <div className="flex flex-wrap gap-2">
            <NativeSelect aria-label="Filtrar por tipo" value={kindFilter} onChange={(e) => setKindFilter(e.target.value as '' | ProjectCostKind)} className="h-9 w-auto text-xs">
              <option value="">Previstos e realizados</option>
              <option value="PLANNED">Somente previstos</option>
              <option value="ACTUAL">Somente realizados</option>
            </NativeSelect>
            <Button variant="outline" size="sm" onClick={exportCosts} disabled={project.costs.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Exportar
            </Button>
            {canEdit && (
              <Button size="sm" onClick={() => setDialog({ open: true, cost: null })}>
                <Plus className="mr-2 h-4 w-4" /> Novo lançamento
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {project.costs.length === 0 ? (
            <EmptyState
              title="Nenhum custo lançado"
              description="Lance os custos previstos para planejar o desembolso e os realizados para acompanhar o orçamento."
              action={canEdit ? <Button size="sm" onClick={() => setDialog({ open: true, cost: null })}><Plus className="mr-2 h-4 w-4" /> Novo lançamento</Button> : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-[11px] uppercase text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Data</th>
                    <th className="py-2 pr-3 font-medium">Tipo</th>
                    <th className="py-2 pr-3 font-medium">Descrição</th>
                    <th className="py-2 pr-3 font-medium">Categoria</th>
                    <th className="py-2 pr-3 text-right font-medium">Valor</th>
                    {canEdit && <th className="py-2 text-right font-medium">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {costs.map((cost) => (
                    <tr key={cost.id} className="border-b last:border-0 align-top">
                      <td className="whitespace-nowrap py-2 pr-3 text-xs">{formatDay(cost.date)}</td>
                      <td className="py-2 pr-3">
                        <span className={cn('pill text-[10px]', cost.kind === 'ACTUAL' ? 'pill-blue' : 'pill-gray')}>{COST_KIND_LABEL[cost.kind]}</span>
                      </td>
                      <td className="py-2 pr-3">
                        <div>{cost.description}</div>
                        {cost.notes && <p className="whitespace-pre-line text-xs text-muted-foreground">{cost.notes}</p>}
                      </td>
                      <td className="py-2 pr-3 text-xs">{cost.category ?? '—'}</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">{formatMoney(cost.amount)}</td>
                      {canEdit && (
                        <td className="py-2">
                          <div className="flex justify-end gap-0.5">
                            <IconButton label={`Editar lançamento ${cost.description}`} disabled={action.isPending} onClick={() => setDialog({ open: true, cost })}>
                              <Pencil className="h-4 w-4" />
                            </IconButton>
                            <IconButton label={`Excluir lançamento ${cost.description}`} disabled={action.isPending} onClick={() => setToDelete(cost)}>
                              <Trash2 className="h-4 w-4" />
                            </IconButton>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CostDialog
        open={dialog.open}
        cost={dialog.cost}
        projectId={project.id}
        categories={categories}
        action={action}
        onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Excluir lançamento"
        description={toDelete ? `O lançamento “${toDelete.description}” de ${formatMoney(toDelete.amount)} será removido.` : undefined}
        confirmLabel="Excluir"
        destructive
        onConfirm={async () => {
          if (toDelete) await settle(action, { path: `/projects/costs/${toDelete.id}`, method: 'DELETE', success: 'Lançamento excluído' });
        }}
      />
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-border/70 bg-card/90 p-3.5 shadow-sm">
      <div className={cn('break-words font-semibold tracking-tight tabular-nums', value.length > 9 ? 'text-base sm:text-lg' : 'text-2xl', tone)}>{value}</div>
      <div className="mt-3 text-xs font-medium text-muted-foreground">{label}</div>
      {hint && <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</div>}
    </div>
  );
}

function CostDialog({
  open,
  cost,
  projectId,
  categories,
  action,
  onOpenChange,
}: {
  open: boolean;
  cost: ProjectCost | null;
  projectId: string;
  categories: string[];
  action: ProjectAction;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm(cost
      ? {
          kind: cost.kind,
          description: cost.description,
          category: cost.category ?? '',
          amount: String(cost.amount),
          date: toDateInput(cost.date),
          notes: cost.notes ?? '',
        }
      : { ...EMPTY, date: todayInput() });
  }, [open, cost]);

  async function submit() {
    const amount = parseAmount(form.amount);
    if (!form.description.trim() || !form.date || amount === null) {
      toast.error('Informe a descrição, a data e um valor igual ou maior que zero.');
      return;
    }
    const json = {
      kind: form.kind,
      description: form.description.trim(),
      category: form.category.trim() || null,
      amount,
      date: form.date,
      notes: form.notes.trim() || null,
    };
    const saved = await settle(action, cost
      ? { path: `/projects/costs/${cost.id}`, method: 'PATCH', json, success: 'Lançamento atualizado' }
      : { path: `/projects/${projectId}/costs`, method: 'POST', json, success: 'Lançamento adicionado' });
    if (saved) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !action.isPending && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{cost ? 'Editar lançamento' : 'Novo lançamento'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="cost-kind">Tipo</Label>
              <NativeSelect id="cost-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ProjectCostKind })}>
                <option value="ACTUAL">Realizado</option>
                <option value="PLANNED">Previsto</option>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost-date">Data *</Label>
              <Input id="cost-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost-amount">Valor (R$) *</Label>
              <Input id="cost-amount" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cost-description">Descrição *</Label>
            <Input id="cost-description" value={form.description} maxLength={240} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: Contratação de consultoria" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cost-category">Categoria</Label>
            <Input id="cost-category" list="cost-categories" value={form.category} maxLength={80} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex.: Serviços, Materiais, Pessoal" />
            <datalist id="cost-categories">
              {categories.map((category) => <option key={category} value={category} />)}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cost-notes">Observações</Label>
            <Textarea id="cost-notes" rows={2} value={form.notes} maxLength={2000} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={action.isPending} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={action.isPending}>
            {action.isPending ? 'Salvando...' : cost ? 'Salvar alterações' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
