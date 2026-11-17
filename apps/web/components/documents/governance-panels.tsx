'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, ExternalLink, GitBranch, Link2, Loader2, Lock, MessageSquarePlus, Network, Plus, Save, Trash2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CONFIDENTIALITY_HINT, CONFIDENTIALITY_LABEL, formatDateTime, isPublishedLike, toInputDate, type ChangeRequest, type Confidentiality, type DocDetail, type DocOptions, type DocStatus, type DocSummaryRow } from './types';
import { EmptyState, Field, MultiSelect, StatusBadge, errorMessage, groupOptions, invalidateDocuments, nodeOptions, userOptions } from './ui';

type RelatedDoc = { id: string; code: string | null; number: number; title: string; status: DocStatus; version: number };
interface Relations {
  outgoing: Array<{ id: string; kind: string; document: RelatedDoc }>;
  incoming: Array<{ id: string; kind: string; document: RelatedDoc }>;
}
interface Impact {
  processes: Array<{ id: string; process: { id: string; code: string | null; name: string }; activity: { id: string; name: string } | null; label: string | null; scope: string }>;
  monthlyMeetings: { standardizations: Array<{ id: string; description: string; status: string; meetingId: string }>; attachments: Array<{ id: string; fileName: string; meetingId: string }> };
  referencedBy: Relations['incoming'];
  references: Relations['outgoing'];
  pendingReads: number;
  openChangeRequests: number;
  total: number;
}

const RELATION_LABEL: Record<string, string> = { REFERENCES: 'Faz referência a', REPLACES: 'Substitui', COMPLEMENTS: 'Complementa' };
const RELATION_INCOMING: Record<string, string> = { REFERENCES: 'É citado por', REPLACES: 'Substituído por', COMPLEMENTS: 'Complementado por' };

// ----------------------------------------------------------------- vínculos

export function LinksPanel({ doc }: { doc: DocDetail }) {
  const qc = useQueryClient();
  const canEdit = doc.capabilities.canEditMetadata;
  const relations = useQuery<Relations>({ queryKey: ['documents', doc.id, 'relations'], queryFn: () => api<Relations>(`/documents/${doc.id}/relations`) });
  const impact = useQuery<Impact>({ queryKey: ['documents', doc.id, 'impact'], queryFn: () => api<Impact>(`/documents/${doc.id}/impact`) });
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('REFERENCES');
  const candidates = useQuery<{ items: DocSummaryRow[] }>({
    queryKey: ['documents', 'search', 'relation', search],
    queryFn: () => api<{ items: DocSummaryRow[] }>(`/documents/search?${new URLSearchParams({ q: search, pageSize: '8' }).toString()}`),
    enabled: canEdit && search.trim().length >= 2,
  });

  const add = useMutation({
    mutationFn: (documentId: string) => api(`/documents/${doc.id}/relations`, { method: 'POST', json: { documentId, kind } }),
    onSuccess: () => {
      toast.success('Relação adicionada.');
      setSearch('');
      void qc.invalidateQueries({ queryKey: ['documents', doc.id] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (relationId: string) => api(`/documents/${doc.id}/relations/${relationId}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['documents', doc.id] }),
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Network className="h-4 w-4" />Processos que usam este documento</CardTitle>
          <CardDescription>O vínculo é feito no mapeamento do processo (Processos › atividade › documentos).</CardDescription>
        </CardHeader>
        <CardContent>
          {doc.processLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum processo vinculado.</p>
          ) : (
            <ul className="space-y-2">
              {doc.processLinks.map((link) => (
                <li key={link.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{link.process.code ? `${link.process.code} · ` : ''}{link.process.name}</p>
                    <p className="text-xs text-muted-foreground">{link.activity ? `Atividade: ${link.activity.name}` : 'Processo inteiro'}{link.label ? ` · ${link.label}` : ''}</p>
                  </div>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/processes/${link.process.id}`} aria-label="Abrir processo"><ExternalLink className="h-4 w-4" /></Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4" />Documentos relacionados</CardTitle>
          <CardDescription>Referências, substituições e complementos entre documentos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {canEdit && (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <div className="flex gap-2">
                <NativeSelect value={kind} onChange={(event) => setKind(event.target.value)} className="w-44">
                  <option value="REFERENCES">Faz referência a</option>
                  <option value="COMPLEMENTS">Complementa</option>
                  <option value="REPLACES">Substitui</option>
                </NativeSelect>
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar documento por código ou título" />
              </div>
              {search.trim().length >= 2 && (
                <ul className="max-h-48 space-y-1 overflow-y-auto">
                  {(candidates.data?.items ?? []).filter((item) => item.id !== doc.id).map((item) => (
                    <li key={item.id}>
                      <button type="button" className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => add.mutate(item.id)}>
                        <span className="truncate">{item.code ?? `#${item.number}`} · {item.title}</span>
                        <Plus className="h-4 w-4 shrink-0 text-primary" />
                      </button>
                    </li>
                  ))}
                  {candidates.data && candidates.data.items.length === 0 && <li className="px-2 py-1 text-xs text-muted-foreground">Nada encontrado.</li>}
                </ul>
              )}
            </div>
          )}
          {relations.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (relations.data?.outgoing.length ?? 0) + (relations.data?.incoming.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma relação registrada.</p>
          ) : (
            <ul className="space-y-2">
              {relations.data?.outgoing.map((relation) => (
                <li key={relation.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <Link href={`/documents/${relation.document.id}`} className="min-w-0 hover:underline">
                    <span className="block text-xs text-muted-foreground">{RELATION_LABEL[relation.kind] ?? relation.kind}</span>
                    <span className="block truncate text-sm font-medium">{relation.document.code ?? `#${relation.document.number}`} · {relation.document.title}</span>
                  </Link>
                  <div className="flex items-center gap-1">
                    <StatusBadge status={relation.document.status} />
                    {canEdit && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Remover relação" onClick={() => remove.mutate(relation.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
              {relations.data?.incoming.map((relation) => (
                <li key={relation.id} className="flex items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2">
                  <Link href={`/documents/${relation.document.id}`} className="min-w-0 hover:underline">
                    <span className="block text-xs text-muted-foreground">{RELATION_INCOMING[relation.kind] ?? relation.kind}</span>
                    <span className="block truncate text-sm font-medium">{relation.document.code ?? `#${relation.document.number}`} · {relation.document.title}</span>
                  </Link>
                  <StatusBadge status={relation.document.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><GitBranch className="h-4 w-4" />Análise de impacto</CardTitle>
          <CardDescription>O que depende deste documento. Confira antes de torná-lo obsoleto ou substituí-lo.</CardDescription>
        </CardHeader>
        <CardContent>
          {impact.isLoading || !impact.data ? (
            <p className="text-sm text-muted-foreground">Calculando…</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ImpactTile label="Processos e atividades" value={impact.data.processes.length} />
              <ImpactTile label="Documentos que citam este" value={impact.data.referencedBy.length} />
              <ImpactTile label="Reuniões (padronizações e anexos)" value={impact.data.monthlyMeetings.standardizations.length + impact.data.monthlyMeetings.attachments.length} />
              <ImpactTile label="Leituras pendentes" value={impact.data.pendingReads} />
              {impact.data.openChangeRequests > 0 && <ImpactTile label="Solicitações em aberto" value={impact.data.openChangeRequests} warn />}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ImpactTile({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={warn || value > 0 ? 'rounded-lg border border-status-yellow/40 bg-status-yellow/5 px-3 py-2' : 'rounded-lg border px-3 py-2'}>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// -------------------------------------------------------------------- acesso

export function AccessPanel({ doc, options }: { doc: DocDetail; options: DocOptions | undefined }) {
  const qc = useQueryClient();
  const access = useQuery<{ confidentiality: Confidentiality; users: Array<{ id: string }>; orgNodes: Array<{ id: string }>; groups: Array<{ id: string }> }>({
    queryKey: ['documents', doc.id, 'access'],
    queryFn: () => api(`/documents/${doc.id}/access`),
  });
  const [level, setLevel] = useState<Confidentiality>(doc.confidentiality);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [orgNodeIds, setOrgNodeIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);

  useEffect(() => {
    if (!access.data) return;
    setLevel(access.data.confidentiality);
    setUserIds(access.data.users.map((item) => item.id));
    setOrgNodeIds(access.data.orgNodes.map((item) => item.id));
    setGroupIds(access.data.groups.map((item) => item.id));
  }, [access.data]);

  const save = useMutation({
    mutationFn: () => api(`/documents/${doc.id}/access`, { method: 'PUT', json: { confidentiality: level, userIds, orgNodeIds, groupIds } }),
    onSuccess: () => {
      toast.success('Acesso atualizado.');
      invalidateDocuments(qc);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Card className="max-w-3xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Lock className="h-4 w-4" />Classificação e acesso</CardTitle>
        <CardDescription>Responsável, participantes do fluxo e gestores do GED sempre enxergam o documento.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(CONFIDENTIALITY_LABEL) as Confidentiality[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setLevel(item)}
              className={level === item ? 'rounded-lg border border-primary bg-primary/5 px-3 py-2 text-left ring-1 ring-primary/30' : 'rounded-lg border px-3 py-2 text-left hover:border-primary/40'}
            >
              <span className="block text-sm font-semibold">{CONFIDENTIALITY_LABEL[item]}</span>
              <span className="block text-xs text-muted-foreground">{CONFIDENTIALITY_HINT[item]}</span>
            </button>
          ))}
        </div>
        {level !== 'INTERNAL' ? (
          <div className="space-y-3">
            <Field label="Pessoas autorizadas"><MultiSelect options={userOptions(options?.users)} value={userIds} onChange={setUserIds} /></Field>
            <Field label="Áreas autorizadas"><MultiSelect options={nodeOptions(options?.allOrgNodes)} value={orgNodeIds} onChange={setOrgNodeIds} /></Field>
            {(options?.groups.length ?? 0) > 0 && <Field label="Grupos autorizados"><MultiSelect options={groupOptions(options?.groups)} value={groupIds} onChange={setGroupIds} /></Field>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Documento interno: quem tem acesso à área do documento consegue ler.</p>
        )}
        {level === 'CONFIDENTIAL' && (
          <p className="flex items-center gap-2 rounded-md bg-status-red/5 px-3 py-2 text-xs text-status-red">
            <AlertTriangle className="h-4 w-4" /> Confidencial: o conteúdo nunca é enviado para a IA, não aparece no assistente nem nos vínculos de processo.
          </p>
        )}
        <Button size="sm" disabled={save.isPending || access.isLoading} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Salvar acesso
        </Button>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------- documento externo

export function ExternalPanel({ doc }: { doc: DocDetail }) {
  const qc = useQueryClient();
  const meta = doc.externalMetadata;
  const [form, setForm] = useState({ issuer: '', responsibleAgency: '', externalNumber: '', issueDate: '', expirationDate: '', sourceLink: '', requiresRenewal: false, alertDays: '' });
  useEffect(() => {
    setForm({
      issuer: meta?.issuer ?? '',
      responsibleAgency: meta?.responsibleAgency ?? '',
      externalNumber: meta?.externalNumber ?? '',
      issueDate: toInputDate(meta?.issueDate),
      expirationDate: toInputDate(meta?.expirationDate),
      sourceLink: meta?.sourceLink ?? '',
      requiresRenewal: Boolean(meta?.requiresRenewal),
      alertDays: meta?.alertDays ? String(meta.alertDays) : '',
    });
  }, [meta]);
  const save = useMutation({
    mutationFn: () => api(`/documents/${doc.id}/external`, { method: 'PUT', json: { ...form, alertDays: form.alertDays ? Number(form.alertDays) : null } }),
    onSuccess: () => {
      toast.success('Dados do documento externo salvos.');
      invalidateDocuments(qc);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const canEdit = doc.capabilities.canEditMetadata;
  const patch = (next: Partial<typeof form>) => setForm((current) => ({ ...current, ...next }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Documento externo</CardTitle>
        <CardDescription>Normas, legislação e documentos de clientes/fornecedores: a validade dispara o aviso de conferência da edição.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Field label="Emissor"><Input value={form.issuer} disabled={!canEdit} onChange={(event) => patch({ issuer: event.target.value })} placeholder="Ex.: ABNT, ANVISA, cliente" /></Field>
        <Field label="Órgão responsável"><Input value={form.responsibleAgency} disabled={!canEdit} onChange={(event) => patch({ responsibleAgency: event.target.value })} /></Field>
        <Field label="Número / identificação"><Input value={form.externalNumber} disabled={!canEdit} onChange={(event) => patch({ externalNumber: event.target.value })} placeholder="Ex.: NBR ISO 9001:2015" /></Field>
        <Field label="Link da fonte"><Input value={form.sourceLink} disabled={!canEdit} onChange={(event) => patch({ sourceLink: event.target.value })} placeholder="https://" /></Field>
        <Field label="Data de emissão"><Input type="date" value={form.issueDate} disabled={!canEdit} onChange={(event) => patch({ issueDate: event.target.value })} /></Field>
        <Field label="Conferir edição até"><Input type="date" value={form.expirationDate} disabled={!canEdit} onChange={(event) => patch({ expirationDate: event.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" className="h-4 w-4" checked={form.requiresRenewal} disabled={!canEdit} onChange={(event) => patch({ requiresRenewal: event.target.checked })} />
          Exige renovação (licença, certificado, alvará)
        </label>
        {canEdit && (
          <div className="sm:col-span-2">
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
              <Save className="mr-1.5 h-4 w-4" /> Salvar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------- solicitações de alteração

const SOURCE_LABEL: Record<string, string> = {
  DEVIATION: 'Desvio',
  ACTION: 'Plano de ação',
  PROCESS: 'Processo',
  AUDIT: 'Auditoria',
  NONCONFORMITY: 'Não conformidade',
  RISK: 'Risco',
  OTHER: 'Outro',
};

const REQUEST_STATUS: Record<ChangeRequest['status'], { label: string; className: string }> = {
  OPEN: { label: 'Em aberto', className: 'border-status-yellow/40 text-status-yellow' },
  ACCEPTED: { label: 'Aceita', className: 'border-status-blue/40 text-status-blue' },
  REJECTED: { label: 'Recusada', className: 'border-status-red/40 text-status-red' },
  IMPLEMENTED: { label: 'Implementada', className: 'border-status-green/40 text-status-green' },
  CANCELLED: { label: 'Cancelada', className: 'text-muted-foreground' },
};

export function ChangeRequestsPanel({ doc }: { doc: DocDetail }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ reason: '', proposal: '', sourceType: '' });
  const [decision, setDecision] = useState<{ request: ChangeRequest; accept: boolean } | null>(null);
  const [note, setNote] = useState('');
  const [openRevision, setOpenRevision] = useState(true);
  const canDecide = doc.capabilities.canEditMetadata || doc.capabilities.isAuthor || doc.capabilities.isManager;

  const create = useMutation({
    mutationFn: () => api(`/documents/${doc.id}/change-requests`, { method: 'POST', json: { reason: form.reason.trim(), proposal: form.proposal.trim() || null, sourceType: form.sourceType || null } }),
    onSuccess: () => {
      toast.success('Solicitação enviada ao responsável.');
      setOpen(false);
      setForm({ reason: '', proposal: '', sourceType: '' });
      invalidateDocuments(qc);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const decide = useMutation({
    mutationFn: () =>
      api(`/documents/change-requests/${decision?.request.id}/decide`, {
        method: 'POST',
        json: { decision: decision?.accept ? 'ACCEPT' : 'REJECT', note: note.trim() || null, openRevision: decision?.accept && openRevision && isPublishedLike(doc.status) },
      }),
    onSuccess: () => {
      toast.success(decision?.accept ? 'Solicitação aceita.' : 'Solicitação recusada.');
      setDecision(null);
      setNote('');
      invalidateDocuments(qc);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const requests = doc.changeRequests;
  const sorted = useMemo(() => [...requests].sort((a, b) => (a.status === 'OPEN' ? -1 : 0) - (b.status === 'OPEN' ? -1 : 0)), [requests]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">Solicitações de alteração</CardTitle>
          <CardDescription>Quem usa o documento pede a mudança; o responsável aceita e abre a nova revisão.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <MessageSquarePlus className="mr-1.5 h-4 w-4" /> Pedir alteração
        </Button>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <EmptyState title="Nenhuma solicitação" description="Viu algo desatualizado? Peça a alteração por aqui: fica registrado e o responsável é avisado." />
        ) : (
          <ul className="space-y-2">
            {sorted.map((request) => (
              <li key={request.id} className="rounded-lg border px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {request.requester?.name ?? 'Usuário'}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{formatDateTime(request.createdAt)}{request.sourceType ? ` · ${SOURCE_LABEL[request.sourceType] ?? request.sourceType}` : ''}</span>
                  </p>
                  <Badge variant="outline" className={REQUEST_STATUS[request.status]?.className}>{REQUEST_STATUS[request.status]?.label ?? request.status}</Badge>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{request.reason}</p>
                {request.proposal && <p className="mt-1 whitespace-pre-wrap rounded bg-muted/40 px-2 py-1 text-xs">Proposta: {request.proposal}</p>}
                {request.decisionNote && <p className="mt-1 text-xs text-muted-foreground">Resposta de {request.decidedBy?.name ?? 'responsável'}: {request.decisionNote}</p>}
                {request.status === 'OPEN' && canDecide && (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => { setDecision({ request, accept: true }); setNote(''); setOpenRevision(true); }}>
                      <CheckCircle2 className="mr-1.5 h-4 w-4" /> Aceitar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setDecision({ request, accept: false }); setNote(''); }}>
                      <XCircle className="mr-1.5 h-4 w-4" /> Recusar
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(next) => !create.isPending && setOpen(next)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Pedir alteração</DialogTitle></DialogHeader>
          <Field label="O que precisa mudar e por quê" required>
            <Textarea rows={4} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
          </Field>
          <Field label="Sugestão de texto (opcional)">
            <Textarea rows={3} value={form.proposal} onChange={(event) => setForm({ ...form, proposal: event.target.value })} />
          </Field>
          <Field label="Origem">
            <NativeSelect value={form.sourceType} onChange={(event) => setForm({ ...form, sourceType: event.target.value })}>
              <option value="">Não informada</option>
              {Object.entries(SOURCE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </NativeSelect>
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={form.reason.trim().length < 5 || create.isPending} onClick={() => create.mutate()}>Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(decision)} onOpenChange={(next) => !next && setDecision(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{decision?.accept ? 'Aceitar solicitação' : 'Recusar solicitação'}</DialogTitle></DialogHeader>
          <Field label={decision?.accept ? 'Comentário (opcional)' : 'Motivo da recusa'} required={!decision?.accept}>
            <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          {decision?.accept && isPublishedLike(doc.status) && doc.capabilities.canRevise && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={openRevision} onChange={(event) => setOpenRevision(event.target.checked)} />
              Abrir a nova revisão agora
            </label>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)}>Cancelar</Button>
            <Button disabled={decide.isPending || (!decision?.accept && !note.trim())} onClick={() => decide.mutate()}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
