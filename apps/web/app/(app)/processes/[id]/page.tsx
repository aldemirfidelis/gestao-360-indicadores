'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ProcessIntegrationType } from '@g360/shared';
import { PageHeader } from '@/components/shell/page-header';
import { SecondarySection } from '@/components/platform/secondary-section';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ArtifactWorkspace } from '@/components/processes/artifact-workspace';
import { EntityPicker } from '@/components/processes/entity-picker';
import { STATE_LABEL, TARGET_LABEL, type Artifact, type ArtifactKind, type ProcessContext } from '@/components/processes/types';
import { ProcessImprovement } from '@/components/processes/process-improvement';

export default function ProcessDetailPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { user, hasPermission } = useAuth();
  const canEdit = !user?.isDemo && hasPermission(['processes:update']);
  const [tab, setTab] = useState(params.get('tab') === 'pmo' ? 'pmo' : params.has('artifact') ? 'BPMN' : 'overview');
  const [artifactId, setArtifactId] = useState(params.get('artifact') || '');
  const [dirty, setDirty] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ kind: 'SIPOC' as ArtifactKind, name: '', scenario: 'AS_IS', basedOnId: '' });
  const [compareIds, setCompareIds] = useState({ before: '', after: '' });
  const context = useQuery({ queryKey: ['process-context', id], queryFn: () => api<ProcessContext>(`/processes/${id}/context`), refetchOnWindowFocus: false, refetchOnReconnect: false });
  const requestedArtifact = params.get('artifact');
  const openedRequest = useRef<string | null>(null);
  useEffect(() => {
    if (!requestedArtifact || openedRequest.current === requestedArtifact) return;
    const match = context.data?.artifacts.find((item) => item.id === requestedArtifact);
    if (match) { openedRequest.current = requestedArtifact; setTab(match.kind); setArtifactId(match.id); }
  }, [requestedArtifact, context.data?.artifacts]);
  const isTool = ['SIPOC', 'BPMN', 'RACI'].includes(tab);
  const options = context.data?.artifacts.filter((item) => item.kind === tab) ?? [];
  const activeId = options.some((item) => item.id === artifactId) ? artifactId : options[0]?.id;
  const artifact = useQuery({ queryKey: ['process-artifact', activeId], queryFn: () => api<Artifact>(`/processes/governance/artifacts/${activeId}`), enabled: isTool && Boolean(activeId), refetchOnWindowFocus: false, refetchOnReconnect: false });
  const refresh = (saved?: Artifact) => {
    if (saved) {
      qc.setQueryData(['process-artifact', saved.id], saved);
      qc.setQueryData<ProcessContext>(['process-context', id], (current) => current ? { ...current, artifacts: [saved, ...current.artifacts.filter((item) => item.id !== saved.id)] } : current);
      setArtifactId(saved.id);
    }
    qc.invalidateQueries({ queryKey: ['process-context', id] });
    setDirty(false);
  };
  const discard = () => !dirty || window.confirm('Há alterações não salvas. Deseja descartá-las?');
  const create = useMutation({ mutationFn: () => api<Artifact>(`/processes/${id}/artifacts`, { method: 'POST', json: { ...form, basedOnId: form.basedOnId || null } }), onSuccess: (saved) => { setCreateOpen(false); setTab(saved.kind); refresh(saved); toast.success('Artefato criado'); }, onError: (error: Error) => toast.error(error.message) });
  const comparison = useQuery({ queryKey: ['process-compare', compareIds], queryFn: () => api<{ added: any[]; removed: any[]; modified: any[] }>(`/processes/governance/artifacts/${compareIds.before}/compare/${compareIds.after}`), enabled: Boolean(compareIds.before && compareIds.after && compareIds.before !== compareIds.after) });
  if (context.isLoading) return <p>Carregando processo...</p>;
  if (context.isError) return <div role="alert" className="space-y-3"><p>{context.error.message}</p><Button onClick={() => context.refetch()}>Tentar novamente</Button></div>;
  if (!context.data) return null;
  const data = context.data;
  return <div className="space-y-5">
    <Link href="/processes" className="text-sm text-muted-foreground hover:underline">← Processos</Link>
    <PageHeader title={data.process.name} description="SIPOC, BPMN, responsabilidades e melhoria contínua no contexto do processo." actions={canEdit && <Button variant="outline" asChild><Link href={`/processes?focus=${id}`}>Dados do processo e etapas</Link></Button>} />
    <Tabs value={tab} onValueChange={(next) => { if (discard()) { setTab(next); setArtifactId(''); setDirty(false); } }}>
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1"><TabsTrigger value="overview">Visão geral</TabsTrigger><TabsTrigger value="SIPOC">SIPOC</TabsTrigger><TabsTrigger value="BPMN">BPMN</TabsTrigger><TabsTrigger value="RACI">Matriz RACI</TabsTrigger><TabsTrigger value="pmo">Melhoria (PMO)</TabsTrigger><TabsTrigger value="links">Registros relacionados</TabsTrigger><TabsTrigger value="history">Histórico</TabsTrigger></TabsList>
      <TabsContent value="overview" className="space-y-4">
        <Card><CardContent className="space-y-2 p-4"><h2 className="font-semibold">Objetivo e governança</h2><p>{data.process.objective || data.process.description || 'Descreva o objetivo nos dados do processo.'}</p><p className="text-sm text-muted-foreground">Área: {data.process.orgNode?.name || 'Não definida'} · Proprietário: {data.process.owner?.name || 'Não definido'} · Status: {data.process.status === 'ACTIVE' ? 'Ativo' : data.process.status === 'ARCHIVED' ? 'Arquivado' : data.process.status === 'UNDER_REVIEW' ? 'Em revisão' : 'Rascunho'}</p></CardContent></Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Artefatos em revisão', data.metrics.inReview], ['Revisões vencidas', data.metrics.overdueReview], ['Atividades sem responsável', data.metrics.withoutOwner], ['Indicadores fora da meta', data.metrics.indicatorsOffTarget]].map(([label, value]) => <Card key={label}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></CardContent></Card>)}</div>
        <ProcessBasics process={data.process} />

        <SecondarySection title="Atividades modeladas">{!data.activities.length && <p className="text-sm text-muted-foreground">Crie e salve um BPMN para documentar as atividades.</p>}<div className="divide-y">{data.activities.map((activity) => <div key={activity.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>{activity.name} · {activity.artifact?.scenario === 'TO_BE' ? 'TO-BE' : 'AS-IS'}</span><span className="text-muted-foreground">{activity.ownerUserId || activity.orgNodeId || activity.orgJobId ? 'Responsabilidade operacional definida' : 'Responsabilidade pendente'}</span></div>)}</div></SecondarySection>
      </TabsContent>
      {(['SIPOC', 'BPMN', 'RACI'] as const).map((kind) => <TabsContent key={kind} value={kind} className="space-y-4">
        <div className="flex flex-wrap items-center gap-3"><NativeSelect aria-label={`Selecionar ${kind}`} className="max-w-lg" value={activeId || ''} onChange={(event) => { if (discard()) { setArtifactId(event.target.value); setDirty(false); } }}><option value="">Selecione um artefato</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.scenario === 'AS_IS' ? 'AS-IS' : 'TO-BE'} · {STATE_LABEL[item.state]}</option>)}</NativeSelect>{canEdit && data.process.status !== 'ARCHIVED' && <Button onClick={() => { if (!discard()) return; setForm({ kind, name: `${kind === 'RACI' ? 'Responsabilidades' : kind} — ${data.process.name}`, scenario: 'AS_IS', basedOnId: '' }); setCreateOpen(true); }}>Criar {kind}</Button>}</div>
        {!options.length && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum {kind} cadastrado para este processo.</div>}
        {isTool && tab === kind && artifact.isLoading && activeId && <p>Carregando artefato...</p>}
        {tab === kind && artifact.isError && <p role="alert" className="text-status-red">{artifact.error.message}</p>}
        {tab === kind && artifact.data && <ArtifactWorkspace key={`${artifact.data.id}:${artifact.data.revision}`} artifact={artifact.data} context={data} onSaved={refresh} onDirty={setDirty} />}
        {kind === 'BPMN' && <section className="space-y-3 rounded-lg border p-4"><h3 className="font-semibold">Comparar AS-IS e TO-BE</h3><div className="grid gap-3 md:grid-cols-2">{(['before', 'after'] as const).map((side) => <div key={side}><Label>{side === 'before' ? 'Modelo de referência' : 'Modelo proposto'}</Label><NativeSelect value={compareIds[side]} onChange={(event) => setCompareIds({ ...compareIds, [side]: event.target.value })}><option value="">Selecionar BPMN</option>{data.artifacts.filter((item) => item.kind === 'BPMN').map((item) => <option key={item.id} value={item.id}>{item.name} · {item.scenario}</option>)}</NativeSelect></div>)}</div>{comparison.isLoading && compareIds.before && compareIds.after && <p>Comparando...</p>}{comparison.isError && <p role="alert">{comparison.error.message}</p>}{comparison.data && <div className="grid gap-3 sm:grid-cols-3">{([['added', 'Adicionadas'], ['removed', 'Removidas'], ['modified', 'Modificadas']] as const).map(([key, label]) => <div key={key}><h4 className="font-medium">{label}: {comparison.data[key].length}</h4>{comparison.data[key].map((activity) => <p key={activity.elementId} className="text-sm text-muted-foreground">{activity.name}</p>)}</div>)}</div>}</section>}
      </TabsContent>)}
      <TabsContent value="pmo"><ProcessImprovement context={data} canEditProcess={canEdit && data.process.status !== 'ARCHIVED'} onLinksChanged={() => refresh()} onOpenLinks={() => setTab('links')} /></TabsContent>
      <TabsContent value="links"><ProcessIntegrations context={data} canEdit={canEdit} refresh={() => refresh()} /></TabsContent>
      <TabsContent value="history"><div className="divide-y rounded-lg border">{data.history.map((event) => <div key={event.id} className="p-4"><div className="font-medium">{event.title}</div><p className="text-sm">{event.description}</p><p className="text-xs text-muted-foreground">{formatDate(event.occurredAt)}</p></div>)}{!data.history.length && <p className="p-6 text-muted-foreground">Nenhum evento registrado.</p>}</div></TabsContent>
    </Tabs>
    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>Criar {form.kind}</DialogTitle></DialogHeader><div className="space-y-3"><div className="space-y-1"><Label>Nome</Label><Input aria-label="Nome do novo artefato" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div><div className="space-y-1"><Label>Cenário</Label><NativeSelect value={form.scenario} onChange={(event) => setForm({ ...form, scenario: event.target.value })}><option value="AS_IS">AS-IS — processo atual</option><option value="TO_BE">TO-BE — processo proposto</option></NativeSelect></div><div className="space-y-1"><Label>Usar modelo existente como base</Label><NativeSelect value={form.basedOnId} onChange={(event) => setForm({ ...form, basedOnId: event.target.value })}><option value="">Iniciar com dados do processo</option>{data.artifacts.filter((item) => item.kind === form.kind).map((item) => <option key={item.id} value={item.id}>{item.name} · versão {item.version}</option>)}</NativeSelect></div></div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button disabled={create.isPending || !form.name.trim()} onClick={() => create.mutate()}>{create.isPending ? 'Criando...' : 'Criar artefato'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

/** Dados cadastrais do processo: SIPOC resumido, indicador e etapas do fluxo. */
function ProcessBasics({ process }: { process: ProcessContext['process'] }) {
  const lines = (value?: string | null) => (value ?? '').split(/\r?\n|;/).map((item) => item.trim()).filter(Boolean);
  const sipoc: Array<[string, string[]]> = [['Fornecedores', lines(process.suppliers)], ['Entradas', lines(process.inputs)], ['Saídas', lines(process.outputs)], ['Clientes', lines(process.customers)]];
  const steps = [...(process.steps ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Dados do processo</h2>
          {process.indicator && (
            <Link href={`/indicators/${process.indicator.id}`} className="text-sm text-primary hover:underline">
              Indicador: {process.indicator.code ? `${process.indicator.code} - ` : ''}{process.indicator.name}
            </Link>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sipoc.map(([title, items]) => (
            <div key={title} className="rounded-md border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
              {items.length ? (
                <ul className="mt-1.5 space-y-0.5 text-sm">{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul>
              ) : <p className="mt-1.5 text-sm text-muted-foreground">Não informado</p>}
            </div>
          ))}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Etapas do fluxo ({steps.length})</p>
          {steps.length ? (
            <ol className="space-y-1 text-sm">
              {steps.map((step, index) => (
                <li key={step.id} className="rounded-md border px-3 py-2">
                  <span className="font-medium">{step.order ?? index + 1}. {step.name}</span>
                  {step.responsible ? <span className="text-muted-foreground"> · {step.responsible}</span> : null}
                  {step.description ? <p className="text-xs text-muted-foreground">{step.description}</p> : null}
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-muted-foreground">Nenhuma etapa cadastrada. Use “Dados do processo e etapas” para incluir.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function ProcessIntegrations({ context, canEdit, refresh }: { context: ProcessContext; canEdit: boolean; refresh: () => void }) {
  const [type, setType] = useState<ProcessIntegrationType>('INDICATOR');
  const [ids, setIds] = useState<string[]>([]);
  const [activityId, setActivityId] = useState('');
  const options = useQuery({ queryKey: ['process-target-types'], queryFn: () => api<{ types: ProcessIntegrationType[] }>('/processes/governance/targets'), staleTime: 20_000 });
  const add = useMutation({ mutationFn: () => api(`/processes/${context.process.id}/integrations`, { method: 'POST', json: { type, targetId: ids[0], activityId: activityId || null } }), onSuccess: () => { setIds([]); refresh(); toast.success('Vínculo criado'); }, onError: (error: Error) => toast.error(error.message) });
  const remove = useMutation({ mutationFn: (id: string) => api(`/processes/governance/integrations/${id}`, { method: 'DELETE' }), onSuccess: refresh, onError: (error: Error) => toast.error(error.message) });
  return <div className="space-y-4">{canEdit && <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-3"><div className="space-y-1"><Label>Tipo de registro</Label><NativeSelect value={type} onChange={(event) => { setType(event.target.value as ProcessIntegrationType); setIds([]); }}>{options.data?.types.map((key) => <option key={key} value={key}>{TARGET_LABEL[key]}</option>)}</NativeSelect></div><div className="space-y-1"><Label>Contexto</Label><NativeSelect value={activityId} onChange={(event) => setActivityId(event.target.value)}><option value="">Processo completo</option>{context.activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</NativeSelect></div><div className="space-y-1"><Label>{TARGET_LABEL[type]}</Label><EntityPicker type={type} label={TARGET_LABEL[type]} selected={ids} onChange={setIds} multiple={false} /></div><Button className="justify-self-start" disabled={!ids[0] || add.isPending} onClick={() => add.mutate()}>Vincular registro existente</Button></div>}
    <p className="text-sm text-muted-foreground">Vincule indicadores, projetos, tarefas, desvios e planos existentes. A abertura e a alteração desses registros seguem as permissões de cada módulo.</p>
    <div className="space-y-2">{context.integrations.map((link) => <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><Link href={link.target.href} className="font-medium text-primary hover:underline">{link.target.name}</Link><p className="text-xs text-muted-foreground">{TARGET_LABEL[link.type]}{link.activityId ? ` · ${context.activities.find((activity) => activity.id === link.activityId)?.name || 'Atividade BPMN'}` : ' · Processo'}{link.target.result ? ` · ${link.target.result.periodRef}: ${link.target.result.value}` : ''}</p></div>{canEdit && !link.artifactId && <Button variant="ghost" size="sm" disabled={remove.isPending} onClick={() => { if (window.confirm('Remover este vínculo? O registro de origem será preservado.')) remove.mutate(link.id); }}>Desvincular</Button>}</div>)}{!context.integrations.length && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum vínculo disponível para seu acesso.</div>}</div>
    {context.hiddenIntegrations > 0 && <p className="text-xs text-muted-foreground">Alguns vínculos não estão disponíveis para seu perfil ou para os módulos habilitados.</p>}
  </div>;
}
