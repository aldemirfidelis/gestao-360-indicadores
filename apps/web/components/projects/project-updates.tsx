'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/platform/confirm-dialog';
import { EmptyState } from '@/components/platform/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { downloadCsv } from '@/lib/compensation/format';
import { cn } from '@/lib/utils';
import { IconButton } from './project-schedule';
import {
  HEALTH_LABEL,
  HEALTH_PILL,
  formatDay,
  toDateInput,
  todayInput,
  type ProjectDetail,
  type ProjectHealth,
  type ProjectUpdate,
} from './types';
import { settle, type ProjectAction } from './use-project';

const EMPTY = { health: 'GREEN' as ProjectHealth, reportDate: '', summary: '', achievements: '', nextSteps: '', blockers: '' };
const HEALTHS: ProjectHealth[] = ['GREEN', 'YELLOW', 'RED'];

/** Status report: relato periódico da situação do projeto, com o avanço registrado no momento. */
export function ProjectUpdates({ project, canEdit, action }: { project: ProjectDetail; canEdit: boolean; action: ProjectAction }) {
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<ProjectUpdate | null>(null);

  function exportUpdates() {
    downloadCsv(`status-report-${project.code ?? 'projeto'}.csv`, [
      ['Data', 'Autor', 'Saúde', 'Avanço (%)', 'Resumo', 'Realizações', 'Próximos passos', 'Pontos de atenção'],
      ...project.updates.map((update) => [
        toDateInput(update.reportDate),
        update.authorName,
        HEALTH_LABEL[update.health],
        update.progress,
        update.summary,
        update.achievements ?? '',
        update.nextSteps ?? '',
        update.blockers ?? '',
      ]),
    ]);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle>Status report ({project.updates.length})</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportUpdates} disabled={project.updates.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Exportar
            </Button>
            {canEdit && (
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Novo status report
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {project.updates.length === 0 && (
            <EmptyState
              title="Nenhum status report registrado"
              description="Registre periodicamente a saúde do projeto, o que foi realizado, os próximos passos e os pontos de atenção."
              action={canEdit ? <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Novo status report</Button> : undefined}
            />
          )}
          {project.updates.map((update) => (
            <article key={update.id} className="rounded-md border p-4 text-sm">
              <header className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('pill text-[10px]', HEALTH_PILL[update.health])}>{HEALTH_LABEL[update.health]}</span>
                  <span className="font-semibold">{formatDay(update.reportDate)}</span>
                  <span className="text-xs text-muted-foreground">por {update.authorName} · avanço de {Math.round(update.progress)}%</span>
                </div>
                {canEdit && (
                  <IconButton label={`Excluir status report de ${formatDay(update.reportDate)}`} disabled={action.isPending} onClick={() => setToDelete(update)}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                )}
              </header>
              <p className="mt-2 whitespace-pre-line">{update.summary}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Section title="Realizações" text={update.achievements} />
                <Section title="Próximos passos" text={update.nextSteps} />
                <Section title="Pontos de atenção" text={update.blockers} />
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

      <UpdateDialog open={open} project={project} action={action} onOpenChange={setOpen} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(next) => !next && setToDelete(null)}
        title="Excluir status report"
        description={toDelete ? `O relato de ${formatDay(toDelete.reportDate)} será removido do histórico do projeto.` : undefined}
        confirmLabel="Excluir"
        destructive
        onConfirm={async () => {
          if (toDelete) await settle(action, { path: `/projects/updates/${toDelete.id}`, method: 'DELETE', success: 'Status report excluído' });
        }}
      />
    </div>
  );
}

function Section({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase text-muted-foreground">{title}</div>
      <p className="mt-0.5 whitespace-pre-line text-xs">{text}</p>
    </div>
  );
}

function UpdateDialog({
  open,
  project,
  action,
  onOpenChange,
}: {
  open: boolean;
  project: ProjectDetail;
  action: ProjectAction;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    // Sugere a saúde a partir do status calculado; quem relata decide o valor final.
    const suggested: ProjectHealth = project.pmoStatus === 'CRITICAL' ? 'RED' : project.pmoStatus === 'AT_RISK' ? 'YELLOW' : 'GREEN';
    setForm({ ...EMPTY, health: suggested, reportDate: todayInput() });
  }, [open, project.pmoStatus]);

  async function submit() {
    if (!form.summary.trim()) {
      toast.error('Escreva o resumo da situação.');
      return;
    }
    const saved = await settle(action, {
      path: `/projects/${project.id}/updates`,
      method: 'POST',
      json: {
        health: form.health,
        reportDate: form.reportDate || undefined,
        summary: form.summary.trim(),
        achievements: form.achievements.trim() || null,
        nextSteps: form.nextSteps.trim() || null,
        blockers: form.blockers.trim() || null,
      },
      success: 'Status report registrado',
    });
    if (saved) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !action.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo status report</DialogTitle>
          <DialogDescription>
            O avanço atual do projeto ({project.progressOverall}%) é gravado junto com o relato.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="update-health">Saúde do projeto *</Label>
              <NativeSelect id="update-health" value={form.health} onChange={(e) => setForm({ ...form, health: e.target.value as ProjectHealth })}>
                {HEALTHS.map((health) => <option key={health} value={health}>{HEALTH_LABEL[health]}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="update-date">Data do relato</Label>
              <Input id="update-date" type="date" value={form.reportDate} max={todayInput()} onChange={(e) => setForm({ ...form, reportDate: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="update-summary">Resumo da situação *</Label>
            <Textarea id="update-summary" rows={3} value={form.summary} maxLength={4000} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="update-achievements">Realizações do período</Label>
            <Textarea id="update-achievements" rows={2} value={form.achievements} maxLength={4000} onChange={(e) => setForm({ ...form, achievements: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="update-next">Próximos passos</Label>
            <Textarea id="update-next" rows={2} value={form.nextSteps} maxLength={4000} onChange={(e) => setForm({ ...form, nextSteps: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="update-blockers">Pontos de atenção</Label>
            <Textarea id="update-blockers" rows={2} value={form.blockers} maxLength={4000} onChange={(e) => setForm({ ...form, blockers: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={action.isPending} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!form.summary.trim() || action.isPending}>
            {action.isPending ? 'Salvando...' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
