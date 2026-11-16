'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { sipocSchema, type RaciContent, type SipocContent } from '@g360/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/components/auth/auth-provider';
import { formatDate } from '@/lib/utils';
import { downloadCsv } from '@/lib/compensation/format';
import { SipocEditor } from './sipoc-editor';
import { RaciEditor } from './raci-editor';
import type { BpmnEditorHandle } from './bpmn-editor';
import { STATE_LABEL, type Artifact, type ProcessContext, type ProcessActivity, type Subject } from './types';

const BpmnEditor = dynamic(() => import('./bpmn-editor').then((module) => module.BpmnEditor), { ssr: false, loading: () => <p>Carregando BPMN...</p> });
const download = (name: string, body: string, mime: string) => { const url = URL.createObjectURL(new Blob([body], { type: mime })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };

export function ArtifactWorkspace({ artifact, context, onSaved, onDirty, readOnly = false }: { artifact: Artifact; context: ProcessContext; onSaved: (artifact: Artifact) => void; onDirty: (dirty: boolean) => void; readOnly?: boolean }) {
  const { user, hasPermission } = useAuth();
  const editable = !readOnly && !user?.isDemo && hasPermission(['processes:update']) && artifact.state === 'DRAFT' && context.process.status !== 'ARCHIVED';
  const [content, setContent] = useState<SipocContent | RaciContent>(artifact.kind === 'RACI' ? artifact.raci ?? { rows: [] } : artifact.kind === 'SIPOC' ? sipocSchema.parse(artifact.content) : { rows: [] });
  const [name, setName] = useState(artifact.name);
  const [reviewDueAt, setReviewDueAt] = useState(artifact.reviewDueAt?.slice(0, 10) ?? '');
  const [changeNote, setChangeNote] = useState('');
  const [dirty, setDirty] = useState(false);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [versionId, setVersionId] = useState('');
  const [versionList, setVersionList] = useState(artifact.versions);
  const [moreVersions, setMoreVersions] = useState(artifact.versions.length === 100);
  const bpmn = useRef<BpmnEditorHandle>(null);
  const markDirty = () => { setDirty(true); onDirty(true); };
  const change = (next: SipocContent | RaciContent) => { setContent(next); markDirty(); };

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const anchorClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest('a[href]');
      if (anchor && !window.confirm('Há alterações não salvas. Deseja sair sem salvar?')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', beforeUnload); document.addEventListener('click', anchorClick, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', anchorClick, true); };
  }, [dirty]);

  const saved = (result: Artifact) => { setDirty(false); onDirty(false); setError(''); onSaved(result); };
  const save = useMutation({
    mutationFn: async () => {
      const payload = { revision: artifact.revision, name, reviewDueAt: reviewDueAt ? `${reviewDueAt}T12:00:00.000Z` : null, changeNote, ...(artifact.kind === 'BPMN' ? { bpmnXml: await bpmn.current!.xml() } : { content }) };
      return api<Artifact>(`/processes/governance/artifacts/${artifact.id}`, { method: 'PATCH', json: payload });
    },
    onSuccess: (result) => { saved(result); toast.success('Versão salva'); },
    onError: (err: Error) => setError(err.message),
  });
  const transition = useMutation({
    mutationFn: (action: string) => api<Artifact>(`/processes/governance/artifacts/${artifact.id}/transition`, { method: 'POST', json: { revision: artifact.revision, action, changeNote } }),
    onSuccess: (result) => { saved(result); toast.success('Estado atualizado'); }, onError: (err: Error) => setError(err.message),
  });
  const version = useQuery({ queryKey: ['process-version', artifact.id, versionId], queryFn: () => api<{ snapshot: any; version: number; authorName: string; changeNote: string; createdAt: string }>(`/processes/governance/artifacts/${artifact.id}/versions/${versionId}`), enabled: Boolean(versionId) });
  const older = useMutation({ mutationFn: () => api<Artifact['versions']>(`/processes/governance/artifacts/${artifact.id}/versions?before=${versionList[versionList.length - 1].version}`), onSuccess: (items) => { setVersionList((current) => [...current, ...items]); setMoreVersions(items.length === 100); }, onError: (err: Error) => setError(err.message) });
  const selectedActivity = artifact.activities.find((activity) => activity.elementId === selectedElement && activity.active);
  const busy = save.isPending || transition.isPending;
  const exportDiagram = async (svg: boolean) => { try { const body = svg ? await bpmn.current!.svg() : await bpmn.current!.xml(); download(svg ? 'processo.svg' : 'processo.bpmn', body, svg ? 'image/svg+xml' : 'application/xml'); } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao exportar.'); } };
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-muted/20 p-4"><div><div className="text-xs text-muted-foreground">{artifact.scenario === 'AS_IS' ? 'AS-IS · Processo atual' : 'TO-BE · Processo proposto'} · {STATE_LABEL[artifact.state]} · Versão {artifact.version}</div><h2 className="font-semibold">{artifact.name}</h2><p className="text-xs text-muted-foreground">{dirty ? 'Alterações não salvas' : 'Versão salva no processo'}</p></div><div className="flex flex-wrap gap-2">
      {artifact.kind === 'BPMN' && <><Button variant="outline" size="sm" onClick={() => exportDiagram(false)}>Exportar BPMN XML</Button><Button variant="outline" size="sm" onClick={() => exportDiagram(true)}>Exportar SVG</Button></>}
      {artifact.kind === 'SIPOC' && <Button variant="outline" size="sm" onClick={() => { const data = content as SipocContent; const keys = ['suppliers', 'inputs', 'steps', 'outputs', 'customers'] as const; downloadCsv('sipoc.csv', [['Fornecedores', 'Entradas', 'Processo', 'Saídas', 'Clientes'], ...Array.from({ length: Math.max(...keys.map((key) => data[key].length), 1) }, (_, index) => keys.map((key) => { const item = data[key][index]; return item ? `${item.name}${item.description ? ` — ${item.description}` : ''}` : ''; }))]); }}>Exportar SIPOC</Button>}
    </div></div>
    {editable && <div className="grid gap-3 md:grid-cols-2"><div className="space-y-1"><Label>Nome do artefato</Label><Input aria-label="Nome do artefato" value={name} onChange={(event) => { setName(event.target.value); markDirty(); }} /></div><div className="space-y-1"><Label>Próxima revisão</Label><Input type="date" value={reviewDueAt} onChange={(event) => { setReviewDueAt(event.target.value); markDirty(); }} /></div></div>}
    {artifact.kind === 'SIPOC' && <SipocEditor value={content as SipocContent} onChange={change} editable={editable && !busy} process={context.process} />}
    {artifact.kind === 'RACI' && <RaciEditor value={content as RaciContent} onChange={change} editable={editable && !busy} context={context} artifact={artifact} />}
    {artifact.kind === 'BPMN' && <><div inert={busy}><BpmnEditor ref={bpmn} xml={artifact.bpmnXml!} editable={editable} onDirty={markDirty} onSelect={setSelectedElement} /></div>
      {selectedActivity ? <ActivityProperties key={selectedActivity.id} activity={selectedActivity} artifact={artifact} editable={editable && !dirty && !busy} onSaved={saved} integrations={context.integrations} /> : selectedElement && <p className="text-sm text-muted-foreground">Salve o desenho para vincular responsabilidades e registros às novas atividades. Eventos e decisões são editados diretamente no BPMN.</p>}
    </>}
    {(artifact.validation.errors.length > 0 || artifact.validation.warnings.length > 0) && <div className="rounded-lg border bg-muted/20 p-3 text-sm"><h3 className="font-medium">Verificação da versão salva</h3>{artifact.validation.errors.map((issue) => <p key={issue} className="text-status-red">{issue}</p>)}{artifact.validation.warnings.map((issue) => <p key={issue} className="text-muted-foreground">{issue}</p>)}</div>}
    {!readOnly && !user?.isDemo && context.process.status !== 'ARCHIVED' && hasPermission(['processes:update', 'processes:approve', 'processes:publish', 'processes:delete']) && <div className="space-y-3 rounded-lg border p-4"><div className="space-y-1"><Label>Descrição da alteração ou decisão</Label><Textarea aria-label="Descrição da alteração" value={changeNote} onChange={(event) => setChangeNote(event.target.value)} placeholder="Explique o que foi alterado ou o motivo da aprovação / publicação." /></div><div className="flex flex-wrap gap-2">
      {editable && <Button disabled={busy || !changeNote.trim() || !name.trim()} onClick={() => save.mutate()}>{save.isPending ? 'Salvando...' : 'Salvar versão'}</Button>}
      {artifact.state === 'DRAFT' && hasPermission(['processes:update']) && <Button variant="outline" disabled={busy || dirty || !changeNote.trim()} onClick={() => transition.mutate('SUBMIT')}>Enviar para revisão</Button>}
      {artifact.state === 'IN_REVIEW' && hasPermission(['processes:approve']) && <Button disabled={busy || dirty || !changeNote.trim()} onClick={() => transition.mutate('APPROVE')}>Aprovar</Button>}
      {artifact.state === 'APPROVED' && hasPermission(['processes:publish']) && <Button disabled={busy || dirty || !changeNote.trim()} onClick={() => transition.mutate('PUBLISH')}>Publicar</Button>}
      {artifact.state !== 'DRAFT' && hasPermission(['processes:update']) && <Button variant="outline" disabled={busy || !changeNote.trim()} onClick={() => transition.mutate('REVISE')}>Criar revisão</Button>}
      {artifact.state !== 'ARCHIVED' && hasPermission(['processes:delete']) && <Button variant="outline" disabled={busy || dirty || !changeNote.trim()} onClick={() => transition.mutate('ARCHIVE')}>Arquivar</Button>}
    </div><p className="text-xs text-muted-foreground">Versões anteriores permanecem no histórico. Para alterar um modelo aprovado ou publicado, crie uma revisão. Publicar um TO-BE não executa mudanças na operação.</p></div>}
    {error && <div role="alert" className="rounded-lg border border-status-red/30 p-3 text-sm text-status-red">{error}{dirty && <p className="mt-2">O rascunho continua aberto. Exporte os dados antes de recarregar se houver conflito de versão.</p>}</div>}
    {!readOnly && <section className="space-y-2"><h3 className="font-semibold">Histórico de versões</h3><div className="max-h-72 divide-y overflow-y-auto rounded-lg border">{versionList.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><div><strong>Versão {item.version}</strong> · {STATE_LABEL[item.state]}<p className="text-xs text-muted-foreground">{item.authorName} · {formatDate(item.createdAt)} · {item.changeNote}</p></div><Button variant="outline" size="sm" onClick={() => setVersionId(item.id)}>Ver versão</Button></div>)}</div>{moreVersions && <Button variant="outline" size="sm" disabled={older.isPending} onClick={() => older.mutate()}>Carregar versões anteriores</Button>}</section>}
    <Dialog open={Boolean(versionId)} onOpenChange={(open) => { if (!open) setVersionId(''); }}><DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto"><DialogHeader><DialogTitle>Versão preservada {version.data?.version}</DialogTitle></DialogHeader>{version.isLoading && <p>Carregando versão...</p>}{version.isError && <p role="alert">{version.error.message}</p>}{version.data && <ArtifactWorkspace key={versionId} readOnly artifact={{ ...artifact, ...version.data.snapshot, version: version.data.version, raci: version.data.snapshot.raci ?? artifact.raci, versions: [], validation: { errors: [], warnings: [] } }} context={{ ...context, process: { ...context.process, ...version.data.snapshot.process } }} onSaved={() => {}} onDirty={() => {}} />}</DialogContent></Dialog>
  </div>;
}

function ActivityProperties({ activity, artifact, editable, onSaved, integrations }: { activity: ProcessActivity; artifact: Artifact; editable: boolean; onSaved: (artifact: Artifact) => void; integrations: ProcessContext['integrations'] }) {
  const [form, setForm] = useState({ description: activity.description || '', orgNodeId: activity.orgNodeId || '', ownerUserId: activity.ownerUserId || '', orgJobId: activity.orgJobId || '', expectedMinutes: activity.expectedMinutes?.toString() || '', slaMinutes: activity.slaMinutes?.toString() || '', systems: activity.systems || '' });
  const subjects = useQuery({ queryKey: ['process-subjects', ''], queryFn: () => api<Subject[]>('/processes/governance/subjects'), staleTime: 20_000 });
  const save = useMutation({ mutationFn: () => api<Artifact>(`/processes/governance/activities/${activity.id}`, { method: 'PATCH', json: { revision: artifact.revision, ...form, orgNodeId: form.orgNodeId || null, ownerUserId: form.ownerUserId || null, orgJobId: form.orgJobId || null, expectedMinutes: form.expectedMinutes === '' ? null : Number(form.expectedMinutes), slaMinutes: form.slaMinutes === '' ? null : Number(form.slaMinutes) } }), onSuccess: onSaved, onError: (err: Error) => toast.error(err.message) });
  return <section className="space-y-3 rounded-lg border p-4"><h3 className="font-semibold">Contexto operacional: {activity.name}</h3><fieldset disabled={!editable || save.isPending} className="grid gap-3 md:grid-cols-3">
    {([['orgNodeId', 'Área', 'AREA'], ['ownerUserId', 'Responsável', 'USER'], ['orgJobId', 'Cargo / função', 'JOB']] as const).map(([field, label, type]) => <div key={field} className="space-y-1"><Label>{label}</Label><NativeSelect value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })}><option value="">Não definido</option>{subjects.data?.filter((subject) => subject.subjectType === type).map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</NativeSelect></div>)}
    <div className="space-y-1"><Label>Tempo esperado (minutos)</Label><Input type="number" min={0} value={form.expectedMinutes} onChange={(event) => setForm({ ...form, expectedMinutes: event.target.value })} /></div><div className="space-y-1"><Label>SLA (minutos)</Label><Input type="number" min={0} value={form.slaMinutes} onChange={(event) => setForm({ ...form, slaMinutes: event.target.value })} /></div><div className="space-y-1"><Label>Sistemas utilizados</Label><Input value={form.systems} onChange={(event) => setForm({ ...form, systems: event.target.value })} /></div><div className="space-y-1 md:col-span-3"><Label>Detalhes operacionais</Label><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
  </fieldset><Button size="sm" disabled={!editable || save.isPending} onClick={() => save.mutate()}>Salvar propriedades</Button>{!editable && <p className="text-xs text-muted-foreground">As propriedades podem ser alteradas com o desenho salvo em rascunho.</p>}
  <div className="space-y-2">{activity.raciRows?.map((row) => <div key={row.id} className="rounded border p-2 text-sm"><a className="font-medium text-primary hover:underline" href={`/processes/${artifact.processId}?artifact=${row.artifact.id}`}>{row.artifact.name} · {STATE_LABEL[row.artifact.state]}</a><p className="text-xs text-muted-foreground">{row.assignments.map((assignment) => `${assignment.subjectSnapshot.name}: ${assignment.role}`).join(' · ')}</p></div>)}</div>
  <div className="space-y-1 text-sm">{integrations.filter((link) => link.activityId === activity.id).map((link) => <a key={link.id} href={link.target.href} className="block text-primary hover:underline">{link.target.name}</a>)}</div></section>;
}
