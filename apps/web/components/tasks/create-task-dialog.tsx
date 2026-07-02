'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CalendarDays, Palette, Sparkles, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { TaskBoardData, TaskContext } from './task-types';

interface Props {
  open: boolean;
  board?: TaskBoardData;
  context?: TaskContext;
  initialColumnId?: string | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Record<string, unknown>) => void;
}

const COLORS = [
  ['yellow', 'Amarelo', 'bg-amber-200'],
  ['blue', 'Azul', 'bg-sky-200'],
  ['green', 'Verde', 'bg-emerald-200'],
  ['pink', 'Rosa', 'bg-pink-200'],
  ['lilac', 'Lilás', 'bg-violet-200'],
  ['peach', 'Pêssego', 'bg-orange-200'],
] as const;

export function CreateTaskDialog({ open, board, context, initialColumnId, submitting, onOpenChange, onSubmit }: Props) {
  const defaultColumn = initialColumnId ?? board?.columns.find((column) => column.statusKey === 'TODO')?.id ?? '';
  const [form, setForm] = useState({
    title: '',
    description: '',
    columnId: defaultColumn,
    priority: 'MEDIUM',
    assigneeId: '',
    areaId: '',
    projectId: '',
    startDate: '',
    dueDate: '',
    color: 'yellow',
    tags: '',
  });

  useEffect(() => {
    if (open) setForm((current) => ({ ...current, columnId: initialColumnId ?? defaultColumn }));
  }, [defaultColumn, initialColumnId, open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) return;
    onSubmit({
      ...form,
      tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      assigneeId: form.assigneeId || null,
      areaId: form.areaId || null,
      projectId: form.projectId || null,
      startDate: form.startDate || null,
      dueDate: form.dueDate || null,
    });
  }

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <DialogTitle>Nova tarefa manual</DialogTitle>
          <DialogDescription>Crie um post-it para a equipe. O histórico e a posição serão salvos automaticamente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="task-title">Título *</Label>
            <Input id="task-title" autoFocus maxLength={180} placeholder="O que precisa ser feito?" value={form.title} onChange={(event) => set('title', event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-description">Descrição</Label>
            <Textarea id="task-description" rows={4} placeholder="Contexto, resultado esperado e observações..." value={form.description} onChange={(event) => set('description', event.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Coluna">
              <NativeSelect value={form.columnId} onChange={(event) => set('columnId', event.target.value)}>
                {board?.columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Prioridade">
              <NativeSelect value={form.priority} onChange={(event) => set('priority', event.target.value)}>
                <option value="LOW">Baixa</option>
                <option value="MEDIUM">Média</option>
                <option value="HIGH">Alta</option>
                <option value="CRITICAL">Crítica</option>
              </NativeSelect>
            </Field>
            <Field label="Responsável" icon={<UserRound className="h-3.5 w-3.5" />}>
              <NativeSelect value={form.assigneeId} onChange={(event) => set('assigneeId', event.target.value)}>
                <option value="">Sem responsável</option>
                {context?.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Área">
              <NativeSelect value={form.areaId} onChange={(event) => set('areaId', event.target.value)}>
                <option value="">Sem área</option>
                {context?.areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Projeto">
              <NativeSelect value={form.projectId} onChange={(event) => set('projectId', event.target.value)}>
                <option value="">Sem projeto</option>
                {context?.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Etiquetas">
              <Input placeholder="rotina, qualidade" value={form.tags} onChange={(event) => set('tags', event.target.value)} />
            </Field>
            <Field label="Data inicial" icon={<CalendarDays className="h-3.5 w-3.5" />}>
              <Input type="date" value={form.startDate} onChange={(event) => set('startDate', event.target.value)} />
            </Field>
            <Field label="Prazo" icon={<CalendarDays className="h-3.5 w-3.5" />}>
              <Input type="date" value={form.dueDate} onChange={(event) => set('dueDate', event.target.value)} />
            </Field>
            <Field label="Cor do post-it" icon={<Palette className="h-3.5 w-3.5" />}>
              <div className="flex h-10 items-center gap-2 rounded-md border px-2">
                {COLORS.map(([value, label, className]) => (
                  <button
                    key={value}
                    type="button"
                    title={label}
                    aria-label={label}
                    onClick={() => set('color', value)}
                    className={`h-5 w-5 rounded-full border-2 ${className} ${form.color === value ? 'border-foreground ring-2 ring-primary/25' : 'border-transparent'}`}
                  />
                ))}
              </div>
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting || !form.title.trim()}>{submitting ? 'Criando...' : 'Criar tarefa'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{icon}{label}</span>
      {children}
    </label>
  );
}
