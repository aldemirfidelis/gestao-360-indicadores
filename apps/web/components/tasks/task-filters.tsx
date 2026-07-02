'use client';

import { RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { EMPTY_FILTERS, type TaskContext, type TaskFiltersState } from './task-types';
import { ORIGIN_OPTIONS } from './task-utils';

interface Props {
  open: boolean;
  filters: TaskFiltersState;
  context?: TaskContext;
  onChange: (filters: TaskFiltersState) => void;
  onClose: () => void;
}

export function TaskFilters({ open, filters, context, onChange, onClose }: Props) {
  const set = <K extends keyof TaskFiltersState>(key: K, value: TaskFiltersState[K]) => onChange({ ...filters, [key]: value });
  const active = Object.entries(filters).filter(([key, value]) => value !== EMPTY_FILTERS[key as keyof TaskFiltersState]).length;

  return (
    <section className={cn('overflow-hidden rounded-xl border bg-card transition-all', open ? 'max-h-[560px] opacity-100' : 'max-h-0 border-transparent opacity-0')}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Filtros avançados</span>
          {active > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">{active}</span>}
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Filter label="Escopo">
          <NativeSelect value={filters.scope} onChange={(event) => set('scope', event.target.value as TaskFiltersState['scope'])}>
            <option value="all">Todas acessíveis</option>
            <option value="mine">Minhas tarefas</option>
            <option value="area">Tarefas da minha área</option>
          </NativeSelect>
        </Filter>
        <Filter label="Tipo">
          <NativeSelect value={filters.kind} onChange={(event) => set('kind', event.target.value as TaskFiltersState['kind'])}>
            <option value="all">Manuais e automáticas</option>
            <option value="manual">Somente manuais</option>
            <option value="automatic">Somente automáticas</option>
          </NativeSelect>
        </Filter>
        <Filter label="Origem">
          <NativeSelect value={filters.origin} onChange={(event) => set('origin', event.target.value)}>
            <option value="">Todas as origens</option>
            <option value="MANUAL">Manual</option>
            {ORIGIN_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </NativeSelect>
        </Filter>
        <Filter label="Prioridade">
          <NativeSelect value={filters.priority} onChange={(event) => set('priority', event.target.value)}>
            <option value="">Todas</option>
            <option value="CRITICAL">Crítica</option>
            <option value="HIGH">Alta</option>
            <option value="MEDIUM">Média</option>
            <option value="LOW">Baixa</option>
          </NativeSelect>
        </Filter>
        <Filter label="Status">
          <NativeSelect value={filters.status} onChange={(event) => set('status', event.target.value)}>
            <option value="">Todos</option>
            <option value="IDEA">Ideias</option>
            <option value="TODO">A Fazer</option>
            <option value="IN_PROGRESS">Executando</option>
            <option value="REVIEW">Revisão</option>
            <option value="DONE">Realizado</option>
          </NativeSelect>
        </Filter>
        <Filter label="Responsável">
          <NativeSelect value={filters.assigneeId} onChange={(event) => set('assigneeId', event.target.value)}>
            <option value="">Todos</option>
            <option value="__none__">Sem responsável</option>
            {context?.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </NativeSelect>
        </Filter>
        <Filter label="Área">
          <NativeSelect value={filters.areaId} onChange={(event) => set('areaId', event.target.value)}>
            <option value="">Todas</option>
            {context?.areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
          </NativeSelect>
        </Filter>
        <Filter label="Projeto">
          <NativeSelect value={filters.projectId} onChange={(event) => set('projectId', event.target.value)}>
            <option value="">Todos</option>
            {context?.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </NativeSelect>
        </Filter>
        <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
          <input type="checkbox" checked={filters.overdue} onChange={(event) => set('overdue', event.target.checked)} />
          Somente atrasadas
        </label>
        <Filter label="Prazo">
          <NativeSelect value={filters.due} onChange={(event) => set('due', event.target.value as TaskFiltersState['due'])}>
            <option value="">Qualquer prazo</option>
            <option value="today">Vence hoje</option>
            <option value="week">Próximos 7 dias</option>
            <option value="none">Sem prazo</option>
          </NativeSelect>
        </Filter>
        <Filter label="Vínculos">
          <NativeSelect value={filters.linked} onChange={(event) => set('linked', event.target.value as TaskFiltersState['linked'])}>
            <option value="">Com ou sem vínculo</option>
            <option value="true">Com vínculo</option>
            <option value="false">Sem vínculo</option>
          </NativeSelect>
        </Filter>
        <div className="flex items-end">
          <Button variant="outline" className="w-full" onClick={() => onChange(EMPTY_FILTERS)}>
            <RotateCcw className="mr-2 h-4 w-4" />Limpar filtros
          </Button>
        </div>
      </div>
    </section>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
