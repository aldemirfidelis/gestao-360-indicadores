'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import {
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  STATUS_LABEL,
  STATUS_ORDER,
  parseAmount,
  toDateInput,
  type ProjectBase,
  type ProjectPriority,
  type ProjectStatus,
} from './types';
import { useProjectOptions } from './use-project';

/** Opção do seletor de gerente para alguém que não é usuário do sistema. */
const EXTERNAL = '__external__';

const EMPTY = {
  name: '',
  code: '',
  category: '',
  priority: 'MEDIUM' as ProjectPriority,
  status: 'PLANNED' as ProjectStatus,
  managerId: '',
  responsible: '',
  sponsor: '',
  startsAt: '',
  endsAt: '',
  budget: '',
  indicatorId: '',
  description: '',
  objective: '',
  justification: '',
  scope: '',
  outOfScope: '',
  assumptions: '',
  benefits: '',
  actualStartAt: '',
  actualEndAt: '',
  lessonsLearned: '',
};

type FormState = typeof EMPTY;

/** Valores sugeridos ao criar (ex.: indicador e categoria do processo de origem). */
export type ProjectFormDefaults = Partial<Pick<FormState, 'category' | 'indicatorId' | 'description' | 'objective' | 'priority'>>;

function fromProject(project: ProjectBase): FormState {
  return {
    name: project.name,
    code: project.code ?? '',
    category: project.category ?? '',
    priority: project.priority ?? 'MEDIUM',
    status: project.status,
    managerId: project.managerId ?? (project.responsible ? EXTERNAL : ''),
    responsible: project.managerId ? '' : project.responsible ?? '',
    sponsor: project.sponsor ?? '',
    startsAt: toDateInput(project.startsAt),
    endsAt: toDateInput(project.endsAt),
    budget: project.budget === null || project.budget === undefined ? '' : String(project.budget),
    indicatorId: project.indicatorId ?? '',
    description: project.description ?? '',
    objective: project.objective ?? '',
    justification: project.justification ?? '',
    scope: project.scope ?? '',
    outOfScope: project.outOfScope ?? '',
    assumptions: project.assumptions ?? '',
    benefits: project.benefits ?? '',
    actualStartAt: toDateInput(project.actualStartAt),
    actualEndAt: toDateInput(project.actualEndAt),
    lessonsLearned: project.lessonsLearned ?? '',
  };
}

/** Cadastro e edição do projeto: dados gerais, termo de abertura e encerramento. */
export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  onSaved,
  createPath = '/projects',
  defaults,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando informado, o diálogo edita o projeto; sem ele, cria um novo. */
  project?: ProjectBase | null;
  onSaved?: (project: { id: string }) => void;
  /** Rota de criação: um processo cria o projeto já vinculado a ele. */
  createPath?: string;
  defaults?: ProjectFormDefaults;
  title?: string;
}) {
  const qc = useQueryClient();
  const options = useProjectOptions();
  const editing = Boolean(project);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [tab, setTab] = useState('general');
  // Os valores sugeridos só valem quando o diálogo abre; mudanças depois não apagam o que foi digitado.
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  useEffect(() => {
    if (!open) return;
    setForm(project ? fromProject(project) : { ...EMPTY, ...defaultsRef.current });
    setTab('general');
  }, [open, project]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  // Indicador sugerido fora do alcance do usuário em Projetos: começa sem indicador em vez de um valor oculto.
  const visibleIndicators = options.data?.indicators;
  useEffect(() => {
    if (!open || project || !visibleIndicators) return;
    setForm((prev) => (prev.indicatorId && !visibleIndicators.some((indicator) => indicator.id === prev.indicatorId)
      ? { ...prev, indicatorId: '' }
      : prev));
  }, [open, project, visibleIndicators]);

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      project
        ? api<{ id: string }>(`/projects/${project.id}`, { method: 'PATCH', json: payload })
        : api<{ id: string }>(createPath, { method: 'POST', json: payload }),
    onSuccess: (saved) => {
      toast.success(editing ? 'Projeto atualizado' : 'Projeto criado');
      qc.invalidateQueries({ queryKey: ['projects'] });
      if (project) qc.invalidateQueries({ queryKey: ['project', project.id] });
      onOpenChange(false);
      onSaved?.(saved);
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível salvar o projeto'),
  });

  function submit() {
    if (!form.name.trim()) {
      setTab('general');
      toast.error('Informe o nome do projeto.');
      return;
    }
    if (form.startsAt && form.endsAt && form.endsAt < form.startsAt) {
      setTab('general');
      toast.error('O fim previsto não pode ser anterior ao início.');
      return;
    }
    if (form.budget.trim() && parseAmount(form.budget) === null) {
      setTab('general');
      toast.error('Informe um orçamento válido, igual ou maior que zero.');
      return;
    }
    if (form.actualStartAt && form.actualEndAt && form.actualEndAt < form.actualStartAt) {
      setTab('closing');
      toast.error('O fim real não pode ser anterior ao início real.');
      return;
    }
    const text = (value: string) => value.trim() || null;
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      category: text(form.category),
      priority: form.priority,
      status: form.status,
      sponsor: text(form.sponsor),
      startsAt: form.startsAt || null,
      endsAt: form.endsAt || null,
      budget: parseAmount(form.budget),
      indicatorId: form.indicatorId || null,
      description: text(form.description),
      objective: text(form.objective),
      justification: text(form.justification),
      scope: text(form.scope),
      outOfScope: text(form.outOfScope),
      assumptions: text(form.assumptions),
      benefits: text(form.benefits),
    };
    if (form.managerId === EXTERNAL) {
      payload.managerId = null;
      payload.responsible = text(form.responsible);
    } else if (form.managerId) {
      payload.managerId = form.managerId;
    } else {
      payload.managerId = null;
      payload.responsible = null;
    }
    if (editing) {
      if (form.code.trim()) payload.code = form.code.trim();
      payload.actualStartAt = form.actualStartAt || null;
      payload.actualEndAt = form.actualEndAt || null;
      payload.lessonsLearned = text(form.lessonsLearned);
    }
    save.mutate(payload);
  }

  const people = options.data?.people ?? [];
  const indicators = options.data?.indicators ?? [];
  const categories = options.data?.categories ?? [];

  return (
    <Dialog open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle>{title ?? (editing ? 'Editar projeto' : 'Novo projeto')}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Atualize o cadastro, o termo de abertura e os dados de encerramento.'
              : 'Preencha os dados gerais. O código do projeto é gerado automaticamente.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="general">Dados gerais</TabsTrigger>
            <TabsTrigger value="charter">Termo de abertura</TabsTrigger>
            {editing && <TabsTrigger value="closing">Execução e encerramento</TabsTrigger>}
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <div className={editing ? 'grid gap-3 sm:grid-cols-[1fr,160px]' : 'grid gap-3'}>
              <div className="space-y-2">
                <Label htmlFor="project-name">Nome do projeto *</Label>
                <Input
                  id="project-name"
                  value={form.name}
                  maxLength={180}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Ex.: Implantação do plano de melhoria operacional"
                />
              </div>
              {editing && (
                <div className="space-y-2">
                  <Label htmlFor="project-code">Código</Label>
                  <Input id="project-code" value={form.code} maxLength={30} onChange={(e) => set('code', e.target.value)} />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">Descrição</Label>
              <Textarea
                id="project-description"
                rows={3}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Resumo do projeto e das entregas esperadas"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="project-status">Status</Label>
                <NativeSelect id="project-status" value={form.status} onChange={(e) => set('status', e.target.value as ProjectStatus)}>
                  {STATUS_ORDER.map((key) => <option key={key} value={key}>{STATUS_LABEL[key]}</option>)}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-priority">Prioridade</Label>
                <NativeSelect id="project-priority" value={form.priority} onChange={(e) => set('priority', e.target.value as ProjectPriority)}>
                  {PRIORITY_ORDER.map((key) => <option key={key} value={key}>{PRIORITY_LABEL[key]}</option>)}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-category">Categoria</Label>
                <Input
                  id="project-category"
                  list="project-categories"
                  value={form.category}
                  maxLength={80}
                  onChange={(e) => set('category', e.target.value)}
                  placeholder="Ex.: Melhoria, Investimento"
                />
                <datalist id="project-categories">
                  {categories.map((category) => <option key={category} value={category} />)}
                </datalist>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="project-manager">Gerente do projeto</Label>
                <NativeSelect id="project-manager" value={form.managerId} onChange={(e) => set('managerId', e.target.value)}>
                  <option value="">Não definido</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}{person.jobTitle ? ` — ${person.jobTitle}` : ''}
                    </option>
                  ))}
                  <option value={EXTERNAL}>Outra pessoa (sem usuário no sistema)</option>
                </NativeSelect>
                {form.managerId === EXTERNAL && (
                  <Input
                    aria-label="Nome do responsável"
                    value={form.responsible}
                    maxLength={180}
                    onChange={(e) => set('responsible', e.target.value)}
                    placeholder="Nome do responsável"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-sponsor">Patrocinador</Label>
                <Input
                  id="project-sponsor"
                  value={form.sponsor}
                  maxLength={180}
                  onChange={(e) => set('sponsor', e.target.value)}
                  placeholder="Quem patrocina ou demanda o projeto"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="project-start">Início previsto</Label>
                <Input id="project-start" type="date" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-end">Fim previsto</Label>
                <Input id="project-end" type="date" value={form.endsAt} min={form.startsAt || undefined} onChange={(e) => set('endsAt', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-budget">Orçamento (R$)</Label>
                <Input id="project-budget" type="number" min="0" step="0.01" value={form.budget} onChange={(e) => set('budget', e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-indicator">Indicador vinculado</Label>
              <NativeSelect id="project-indicator" value={form.indicatorId} onChange={(e) => set('indicatorId', e.target.value)}>
                <option value="">Sem indicador</option>
                {indicators.map((indicator) => (
                  <option key={indicator.id} value={indicator.id}>
                    {indicator.code ? `[${indicator.code}] ` : ''}{indicator.name}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">
                O indicador mostra o impacto do projeto e define a área que pode consultá-lo e editá-lo.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="charter" className="space-y-4">
            <CharterField id="project-objective" label="Objetivo" value={form.objective} onChange={(value) => set('objective', value)} placeholder="O que o projeto precisa alcançar" />
            <CharterField id="project-justification" label="Justificativa" value={form.justification} onChange={(value) => set('justification', value)} placeholder="Por que o projeto é necessário" />
            <div className="grid gap-4 sm:grid-cols-2">
              <CharterField id="project-scope" label="Escopo" value={form.scope} onChange={(value) => set('scope', value)} placeholder="O que será entregue" />
              <CharterField id="project-out-of-scope" label="Fora do escopo" value={form.outOfScope} onChange={(value) => set('outOfScope', value)} placeholder="O que não faz parte do projeto" />
            </div>
            <CharterField id="project-assumptions" label="Premissas e restrições" value={form.assumptions} onChange={(value) => set('assumptions', value)} placeholder="Condições assumidas, limites de prazo, custo ou recursos" />
            <CharterField id="project-benefits" label="Benefícios esperados" value={form.benefits} onChange={(value) => set('benefits', value)} placeholder="Ganhos esperados com a conclusão" />
          </TabsContent>

          {editing && (
            <TabsContent value="closing" className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="project-actual-start">Início real</Label>
                  <Input id="project-actual-start" type="date" value={form.actualStartAt} onChange={(e) => set('actualStartAt', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-actual-end">Fim real</Label>
                  <Input id="project-actual-end" type="date" value={form.actualEndAt} min={form.actualStartAt || undefined} onChange={(e) => set('actualEndAt', e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                As datas reais são preenchidas automaticamente quando o status muda para “Em andamento” e “Concluído”; ajuste aqui se necessário.
              </p>
              <CharterField id="project-lessons" label="Lições aprendidas" rows={6} value={form.lessonsLearned} onChange={(value) => set('lessonsLearned', value)} placeholder="O que funcionou, o que não funcionou e o que fazer diferente nos próximos projetos" />
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" disabled={save.isPending} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!form.name.trim() || save.isPending}>
            {save.isPending ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar projeto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CharterField({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} rows={rows} value={value} maxLength={4000} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
