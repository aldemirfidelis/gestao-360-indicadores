'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/platform/confirm-dialog';
import { EmptyState } from '@/components/platform/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Stat } from './project-costs';
import { IconButton } from './project-schedule';
import {
  RISK_KIND_LABEL,
  RISK_STATUS_LABEL,
  RISK_STATUS_PILL,
  formatDay,
  isOpenRisk,
  isOverdue,
  riskLevel,
  riskScore,
  toDateInput,
  type PersonOption,
  type ProjectDetail,
  type ProjectRisk,
  type ProjectRiskKind,
  type ProjectRiskStatus,
} from './types';
import { settle, type ProjectAction } from './use-project';

const EXTERNAL = '__external__';
const SCALE = [1, 2, 3, 4, 5];
const SCALE_LABEL: Record<number, string> = { 1: 'Muito baixa', 2: 'Baixa', 3: 'Média', 4: 'Alta', 5: 'Muito alta' };
const IMPACT_LABEL: Record<number, string> = { 1: 'Muito baixo', 2: 'Baixo', 3: 'Médio', 4: 'Alto', 5: 'Muito alto' };
const STATUS_OPTIONS: ProjectRiskStatus[] = ['OPEN', 'MITIGATING', 'RESOLVED', 'ACCEPTED'];

const EMPTY = {
  kind: 'RISK' as ProjectRiskKind,
  title: '',
  description: '',
  probability: '3',
  impact: '3',
  response: '',
  ownerId: '',
  ownerName: '',
  dueDate: '',
  status: 'OPEN' as ProjectRiskStatus,
};

/** Riscos (o que pode acontecer) e impedimentos (o que já está travando) do projeto. */
export function ProjectRisks({
  project,
  canEdit,
  action,
  people,
}: {
  project: ProjectDetail;
  canEdit: boolean;
  action: ProjectAction;
  people: PersonOption[];
}) {
  const [dialog, setDialog] = useState<{ open: boolean; risk: ProjectRisk | null }>({ open: false, risk: null });
  const [toDelete, setToDelete] = useState<ProjectRisk | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const all = project.projectRisks;
  const open = all.filter((risk) => isOpenRisk(risk.status));
  const closedCount = all.length - open.length;
  const visible = [...(showClosed ? all : open)].sort((a, b) => {
    const openDiff = Number(isOpenRisk(b.status)) - Number(isOpenRisk(a.status));
    return openDiff || riskScore(b) - riskScore(a);
  });
  const high = open.filter((risk) => riskScore(risk) >= 15).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Riscos abertos" value={String(open.filter((risk) => risk.kind === 'RISK').length)} />
        <Stat label="Impedimentos abertos" value={String(open.filter((risk) => risk.kind === 'ISSUE').length)} tone={open.some((risk) => risk.kind === 'ISSUE') ? 'text-status-red' : undefined} />
        <Stat label="Exposição alta" value={String(high)} hint="Probabilidade × impacto a partir de 15" tone={high > 0 ? 'text-status-red' : undefined} />
        <Stat label="Encerrados" value={String(closedCount)} />
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle>Riscos e impedimentos</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            {closedCount > 0 && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
                Mostrar encerrados
              </label>
            )}
            {canEdit && (
              <Button size="sm" onClick={() => setDialog({ open: true, risk: null })}>
                <Plus className="mr-2 h-4 w-4" /> Novo registro
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {visible.length === 0 && (
            <EmptyState
              title={all.length === 0 ? 'Nenhum risco ou impedimento registrado' : 'Nenhum registro aberto'}
              description="Registre o que pode comprometer prazo, custo ou escopo e quem responde por tratar."
              action={canEdit ? <Button size="sm" onClick={() => setDialog({ open: true, risk: null })}><Plus className="mr-2 h-4 w-4" /> Novo registro</Button> : undefined}
            />
          )}
          {visible.map((risk) => {
            const score = riskScore(risk);
            const level = riskLevel(score);
            const late = isOpenRisk(risk.status) && isOverdue(risk.dueDate);
            return (
              <div key={risk.id} className={cn('rounded-md border p-3 text-sm', !isOpenRisk(risk.status) && 'opacity-70')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('pill text-[10px]', risk.kind === 'ISSUE' ? 'pill-red' : 'pill-purple')}>{RISK_KIND_LABEL[risk.kind]}</span>
                      <span className={cn('pill text-[10px]', RISK_STATUS_PILL[risk.status])}>{RISK_STATUS_LABEL[risk.status]}</span>
                      <span className={cn('pill text-[10px]', level.pill)} title={`Probabilidade ${risk.probability} × impacto ${risk.impact}`}>
                        Exposição {level.label.toLowerCase()} ({score})
                      </span>
                    </div>
                    <div className="mt-1.5 font-medium">{risk.title}</div>
                    {risk.description && <p className="mt-0.5 whitespace-pre-line text-xs text-muted-foreground">{risk.description}</p>}
                    {risk.response && (
                      <p className="mt-1.5 whitespace-pre-line text-xs">
                        <span className="font-semibold">Plano de resposta: </span>{risk.response}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Responsável: {risk.ownerName ?? '—'}</span>
                      <span className={cn(late && 'font-semibold text-status-red')}>Prazo: {formatDay(risk.dueDate)}{late ? ' (vencido)' : ''}</span>
                      {risk.resolvedAt && <span>Encerrado em {formatDay(risk.resolvedAt)}</span>}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <NativeSelect
                        aria-label={`Situação de ${risk.title}`}
                        value={risk.status}
                        disabled={action.isPending}
                        onChange={(e) => action.mutate({ path: `/projects/risks/${risk.id}`, method: 'PATCH', json: { status: e.target.value } })}
                        className="h-8 w-auto text-xs"
                      >
                        {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{RISK_STATUS_LABEL[status]}</option>)}
                      </NativeSelect>
                      <IconButton label={`Editar ${risk.title}`} disabled={action.isPending} onClick={() => setDialog({ open: true, risk })}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton label={`Excluir ${risk.title}`} disabled={action.isPending} onClick={() => setToDelete(risk)}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <RiskDialog
        open={dialog.open}
        risk={dialog.risk}
        projectId={project.id}
        people={people}
        action={action}
        onOpenChange={(next) => setDialog((prev) => ({ ...prev, open: next }))}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(next) => !next && setToDelete(null)}
        title="Excluir registro"
        description={toDelete ? `“${toDelete.title}” será removido do projeto. Para manter o histórico, prefira mudar a situação para Resolvido ou Aceito.` : undefined}
        confirmLabel="Excluir"
        destructive
        onConfirm={async () => {
          if (toDelete) await settle(action, { path: `/projects/risks/${toDelete.id}`, method: 'DELETE', success: 'Registro excluído' });
        }}
      />
    </div>
  );
}

function RiskDialog({
  open,
  risk,
  projectId,
  people,
  action,
  onOpenChange,
}: {
  open: boolean;
  risk: ProjectRisk | null;
  projectId: string;
  people: PersonOption[];
  action: ProjectAction;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm(risk
      ? {
          kind: risk.kind,
          title: risk.title,
          description: risk.description ?? '',
          probability: String(risk.probability),
          impact: String(risk.impact),
          response: risk.response ?? '',
          ownerId: risk.ownerId ?? (risk.ownerName ? EXTERNAL : ''),
          ownerName: risk.ownerId ? '' : risk.ownerName ?? '',
          dueDate: toDateInput(risk.dueDate),
          status: risk.status,
        }
      : EMPTY);
  }, [open, risk]);

  const score = Number(form.probability) * Number(form.impact);
  const level = riskLevel(score);

  async function submit() {
    if (!form.title.trim()) {
      toast.error('Informe o título.');
      return;
    }
    const json: Record<string, unknown> = {
      kind: form.kind,
      title: form.title.trim(),
      description: form.description.trim() || null,
      probability: Number(form.probability),
      impact: Number(form.impact),
      response: form.response.trim() || null,
      dueDate: form.dueDate || null,
      status: form.status,
    };
    if (form.ownerId === EXTERNAL) {
      json.ownerId = null;
      json.ownerName = form.ownerName.trim() || null;
    } else if (form.ownerId) {
      json.ownerId = form.ownerId;
    } else {
      json.ownerId = null;
      json.ownerName = null;
    }
    const saved = await settle(action, risk
      ? { path: `/projects/risks/${risk.id}`, method: 'PATCH', json, success: 'Registro atualizado' }
      : { path: `/projects/${projectId}/risks`, method: 'POST', json, success: 'Registro adicionado' });
    if (saved) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !action.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{risk ? 'Editar registro' : 'Novo risco ou impedimento'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-[180px,1fr]">
            <div className="space-y-2">
              <Label htmlFor="risk-kind">Tipo</Label>
              <NativeSelect id="risk-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ProjectRiskKind })}>
                <option value="RISK">Risco (pode acontecer)</option>
                <option value="ISSUE">Impedimento (já acontece)</option>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="risk-title">Título *</Label>
              <Input id="risk-title" value={form.title} maxLength={240} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Atraso na entrega do fornecedor" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="risk-description">Descrição</Label>
            <Textarea id="risk-description" rows={2} value={form.description} maxLength={4000} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Causa e consequência para o projeto" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="risk-probability">Probabilidade</Label>
              <NativeSelect id="risk-probability" value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })}>
                {SCALE.map((value) => <option key={value} value={value}>{value} - {SCALE_LABEL[value]}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="risk-impact">Impacto</Label>
              <NativeSelect id="risk-impact" value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })}>
                {SCALE.map((value) => <option key={value} value={value}>{value} - {IMPACT_LABEL[value]}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label>Exposição</Label>
              <div className="flex h-10 items-center">
                <span className={cn('pill', level.pill)}>{level.label} ({score})</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="risk-response">Plano de resposta</Label>
            <Textarea id="risk-response" rows={2} value={form.response} maxLength={4000} onChange={(e) => setForm({ ...form, response: e.target.value })} placeholder="Como evitar, reduzir ou resolver" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="risk-owner">Responsável</Label>
              <NativeSelect id="risk-owner" value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })}>
                <option value="">Não definido</option>
                {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                <option value={EXTERNAL}>Outra pessoa</option>
              </NativeSelect>
              {form.ownerId === EXTERNAL && (
                <Input aria-label="Nome do responsável" value={form.ownerName} maxLength={180} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} placeholder="Nome do responsável" />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="risk-due">Prazo</Label>
              <Input id="risk-due" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="risk-status">Situação</Label>
              <NativeSelect id="risk-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectRiskStatus })}>
                {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{RISK_STATUS_LABEL[status]}</option>)}
              </NativeSelect>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={action.isPending} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!form.title.trim() || action.isPending}>
            {action.isPending ? 'Salvando...' : risk ? 'Salvar alterações' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
