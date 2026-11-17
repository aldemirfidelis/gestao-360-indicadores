'use client';

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  FilePen,
  FilePlus2,
  FileText,
  Inbox,
  Lock,
  MessageSquareWarning,
  PenLine,
  Search,
  Settings,
  ShieldCheck,
  Table2,
  Users,
} from 'lucide-react';
import { normalizeSearchText } from '@g360/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, formatDate } from '@/lib/utils';
import { DocumentCreateDialog } from '@/components/documents/document-create-dialog';
import { DocumentConfig } from '@/components/documents/document-config';
import {
  CONFIDENTIALITY_LABEL,
  STATUS_LABEL,
  TYPE_LABEL,
  type Confidentiality,
  type DocStatus,
  type DocSummaryRow,
  type DocType,
  type Overview,
  type SearchResult,
} from '@/components/documents/types';
import { ConfidentialityBadge, EmptyState, StatusBadge, useDocOptions } from '@/components/documents/ui';

const GROUPS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'published', label: 'Vigentes' },
  { value: 'development', label: 'Em elaboração' },
  { value: 'review', label: 'Em revisão' },
  { value: 'approval', label: 'Em aprovação' },
  { value: 'expired', label: 'Vencidos' },
  { value: 'obsolete', label: 'Obsoletos' },
];

const TABS = ['acervo', 'caixa', 'matriz', 'config'] as const;
type Tab = (typeof TABS)[number];

function useDebounced<T>(value: T, delay = 300) {
  const [current, setCurrent] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setCurrent(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return current;
}

/** Destaca os termos buscados no trecho (ignora acentos e maiúsculas). */
function Highlight({ text, query }: { text: string; query: string }) {
  const tokens = normalizeSearchText(query).split(/\s+/).filter((token) => token.length >= 2);
  const plain = text.normalize('NFC');
  const folded = plain.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (!tokens.length || folded.length !== plain.length) return <>{plain}</>;
  const marks = new Array<boolean>(plain.length).fill(false);
  for (const token of tokens) {
    let index = folded.indexOf(token);
    while (index >= 0) {
      for (let cursor = index; cursor < index + token.length; cursor += 1) marks[cursor] = true;
      index = folded.indexOf(token, index + token.length);
    }
  }
  const parts: ReactNode[] = [];
  let start = 0;
  for (let index = 1; index <= plain.length; index += 1) {
    if (index === plain.length || marks[index] !== marks[start]) {
      const chunk = plain.slice(start, index);
      parts.push(marks[start] ? <mark key={start} className="rounded-sm bg-status-yellow/25 px-0.5 text-foreground">{chunk}</mark> : <span key={start}>{chunk}</span>);
      start = index;
    }
  }
  return <>{parts}</>;
}

function DocRow({ doc, query }: { doc: DocSummaryRow; query: string }) {
  return (
    <Link href={`/documents/${doc.id}`} className="block rounded-lg border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-muted/20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-xs font-semibold text-primary">{doc.code ?? `#${doc.number}`}</span>
            <span className="text-sm font-semibold">{query ? <Highlight text={doc.title} query={query} /> : doc.title}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {doc.typeConfig?.name ?? TYPE_LABEL[doc.type]} · Rev. {String(Math.max(0, doc.version - 1)).padStart(2, '0')}
            {doc.orgNode ? ` · ${doc.orgNode.name}` : ''}
            {doc.owner ? ` · ${doc.owner.name}` : ''}
          </p>
          {doc.snippet ? (
            <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground"><Highlight text={doc.snippet} query={query} /></p>
          ) : doc.description ? (
            <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">{doc.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:flex-col sm:items-end">
          <StatusBadge status={doc.status} />
          <ConfidentialityBadge level={doc.confidentiality} />
          {doc.readRequired && <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><BookOpenCheck className="h-3 w-3" />leitura obrigatória</span>}
          {doc.validUntil && (
            <span className={cn('text-[11px]', doc.isExpired ? 'font-medium text-status-red' : doc.needsReview ? 'text-status-yellow' : 'text-muted-foreground')}>
              {doc.isExpired ? 'Venceu em ' : 'Válido até '}
              {formatDate(doc.validUntil)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ------------------------------------------------------------------- acervo

function Library({ initialGroup }: { initialGroup: string }) {
  const optionsQuery = useDocOptions();
  const options = optionsQuery.data;
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState(initialGroup);
  const [typeConfigId, setTypeConfigId] = useState('');
  const [orgNodeId, setOrgNodeId] = useState('');
  const [confidentiality, setConfidentiality] = useState('');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const term = useDebounced(query.trim());

  useEffect(() => setGroup(initialGroup), [initialGroup]);
  useEffect(() => setPage(1), [term, group, typeConfigId, orgNodeId, confidentiality, sort]);

  const params = useMemo(() => {
    const search = new URLSearchParams({ page: String(page), pageSize: '25', sort });
    if (term) search.set('q', term);
    if (group) search.set('group', group);
    if (typeConfigId) search.set('typeConfigId', typeConfigId);
    if (orgNodeId) search.set('orgNodeId', orgNodeId);
    if (confidentiality) search.set('confidentiality', confidentiality);
    return search.toString();
  }, [term, group, typeConfigId, orgNodeId, confidentiality, sort, page]);

  const results = useQuery<SearchResult>({
    queryKey: ['documents', 'search', params],
    queryFn: () => api<SearchResult>(`/documents/search?${params}`),
    placeholderData: (previous) => previous,
  });
  const data = results.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por código, título ou qualquer palavra do conteúdo (ex.: higienização das mãos)"
            className="pl-9"
            aria-label="Buscar documentos"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
          <NativeSelect value={typeConfigId} onChange={(event) => setTypeConfigId(event.target.value)} aria-label="Tipo">
            <option value="">Todos os tipos</option>
            {(options?.typeConfigs ?? []).map((type) => <option key={type.id} value={type.id}>{type.sigla} · {type.name}</option>)}
          </NativeSelect>
          <NativeSelect value={orgNodeId} onChange={(event) => setOrgNodeId(event.target.value)} aria-label="Área">
            <option value="">Todas as áreas</option>
            {(options?.allOrgNodes ?? []).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
          </NativeSelect>
          <NativeSelect value={confidentiality} onChange={(event) => setConfidentiality(event.target.value)} aria-label="Classificação">
            <option value="">Qualquer classificação</option>
            {(Object.keys(CONFIDENTIALITY_LABEL) as Confidentiality[]).map((level) => <option key={level} value={level}>{CONFIDENTIALITY_LABEL[level]}</option>)}
          </NativeSelect>
          <NativeSelect value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar">
            <option value="recent">Mais recentes</option>
            <option value="code">Código</option>
            <option value="title">Título</option>
            <option value="validity">Validade</option>
          </NativeSelect>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {GROUPS.map((item) => (
          <button
            key={item.value || 'all'}
            type="button"
            onClick={() => setGroup(item.value)}
            className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', group === item.value ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/40')}
          >
            {item.label}
          </button>
        ))}
      </div>

      {results.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-lg bg-muted/40" />)}</div>
      ) : results.isError ? (
        <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="Não foi possível carregar os documentos" description={(results.error as Error)?.message} />
      ) : !data?.items.length ? (
        <EmptyState icon={<FileText className="h-5 w-5" />} title={term ? `Nada encontrado para "${term}"` : 'Nenhum documento neste filtro'} description={term ? 'Tente outras palavras ou tire os filtros.' : 'Crie o primeiro documento ou mude o filtro.'} />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{data.total} documento(s){term ? ` para "${term}"` : ''}</p>
          <div className={cn('space-y-2', results.isFetching && 'opacity-70')}>
            {data.items.map((doc) => <DocRow key={doc.id} doc={doc} query={term} />)}
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-xs text-muted-foreground">Página {page} de {pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// -------------------------------------------------------------- minha caixa

interface InboxDoc { id: string; code: string | null; number: number; title: string; status: DocStatus }
interface InboxData {
  steps: Array<{ id: string; role: 'REVIEW' | 'APPROVAL'; dueAt: string | null; overdue: boolean; document: InboxDoc }>;
  reads: Array<{ id: string; dueAt: string | null; overdue: boolean; document: InboxDoc }>;
  changeRequests: Array<{ id: string; reason: string; sourceType: string | null; createdAt: string; document: InboxDoc }>;
  editRequests: Array<{ id: string; reason: string | null; requester: { id: string; name: string } | null; document: InboxDoc }>;
  adjustments: Array<InboxDoc & { updatedAt: string }>;
  expiring: Array<InboxDoc & { validUntil: string | null }>;
}

function InboxSection({ title, icon, count, children }: { title: string; icon: ReactNode; count: number; children: ReactNode }) {
  if (!count) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">{icon}{title}<span className="ml-auto rounded-full bg-muted px-2 text-xs tabular-nums">{count}</span></CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">{children}</CardContent>
    </Card>
  );
}

function InboxItem({ href, doc, meta, warn }: { href: string; doc: InboxDoc; meta: ReactNode; warn?: boolean }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:border-primary/40 hover:bg-muted/20">
      <span className="min-w-0">
        <span className="block truncate font-medium"><span className="font-mono text-xs text-primary">{doc.code ?? `#${doc.number}`}</span> · {doc.title}</span>
        <span className={cn('block text-xs', warn ? 'font-medium text-status-red' : 'text-muted-foreground')}>{meta}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function InboxPanel() {
  const inbox = useQuery<InboxData>({ queryKey: ['documents', 'inbox'], queryFn: () => api<InboxData>('/documents/inbox') });
  const data = inbox.data;
  if (inbox.isLoading) return <div className="h-40 animate-pulse rounded-lg bg-muted/40" />;
  if (!data) return <EmptyState title="Não foi possível carregar sua caixa." />;
  const total = data.steps.length + data.reads.length + data.changeRequests.length + data.editRequests.length + data.adjustments.length + data.expiring.length;
  if (!total) return <EmptyState icon={<Inbox className="h-5 w-5" />} title="Nada pendente para você no GED" description="Assinaturas, leituras obrigatórias e pedidos de alteração aparecem aqui e no Meu Dia." />;
  const due = (value: string | null) => (value ? `Prazo ${formatDate(value)}` : 'Sem prazo');
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <InboxSection title="Assinar (revisão e aprovação)" icon={<ShieldCheck className="h-4 w-4 text-primary" />} count={data.steps.length}>
        {data.steps.map((step) => (
          <InboxItem key={step.id} href={`/documents/${step.document.id}?tab=fluxo`} doc={step.document} warn={step.overdue} meta={`${step.role === 'REVIEW' ? 'Revisar' : 'Aprovar'} · ${due(step.dueAt)}${step.overdue ? ' · atrasada' : ''}`} />
        ))}
      </InboxSection>
      <InboxSection title="Leitura obrigatória" icon={<BookOpenCheck className="h-4 w-4 text-status-blue" />} count={data.reads.length}>
        {data.reads.map((read) => (
          <InboxItem key={read.id} href={`/documents/${read.document.id}/leitor`} doc={read.document} warn={read.overdue} meta={`${due(read.dueAt)}${read.overdue ? ' · atrasada' : ''}`} />
        ))}
      </InboxSection>
      <InboxSection title="Ajustar ou publicar" icon={<FilePen className="h-4 w-4 text-status-yellow" />} count={data.adjustments.length}>
        {data.adjustments.map((doc) => (
          <InboxItem key={doc.id} href={`/documents/${doc.id}?tab=${doc.status === 'APPROVED' ? 'fluxo' : 'conteudo'}`} doc={doc} meta={doc.status === 'APPROVED' ? 'Aprovado: falta publicar' : STATUS_LABEL[doc.status]} />
        ))}
      </InboxSection>
      <InboxSection title="Pedidos de alteração" icon={<MessageSquareWarning className="h-4 w-4 text-status-purple" />} count={data.changeRequests.length}>
        {data.changeRequests.map((request) => (
          <InboxItem key={request.id} href={`/documents/${request.document.id}?tab=solicitacoes`} doc={request.document} meta={request.reason.slice(0, 120)} />
        ))}
      </InboxSection>
      <InboxSection title="Pedidos de edição" icon={<PenLine className="h-4 w-4" />} count={data.editRequests.length}>
        {data.editRequests.map((request) => (
          <InboxItem key={request.id} href={`/documents/${request.document.id}?tab=conteudo`} doc={request.document} meta={`${request.requester?.name ?? 'Alguém'} pediu para editar`} />
        ))}
      </InboxSection>
      <InboxSection title="Vencendo (sou responsável)" icon={<CalendarClock className="h-4 w-4 text-status-red" />} count={data.expiring.length}>
        {data.expiring.map((doc) => (
          <InboxItem key={doc.id} href={`/documents/${doc.id}?tab=revisoes`} doc={doc} warn={Boolean(doc.validUntil && new Date(doc.validUntil) < new Date())} meta={doc.validUntil ? `Validade ${formatDate(doc.validUntil)}` : 'Sem validade'} />
        ))}
      </InboxSection>
    </div>
  );
}

// ------------------------------------------------------------------- matriz

interface MatrixRow {
  id: string;
  code: string;
  title: string;
  type: DocType;
  typeConfig: { sigla: string; name: string } | null;
  status: DocStatus;
  confidentiality: Confidentiality;
  orgNode: { name: string } | null;
  owner: { name: string } | null;
  approver: { name: string } | null;
  version: number;
  validUntil: string | null;
  publishedAt: string | null;
  isExpired: boolean;
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function MatrixPanel() {
  const options = useDocOptions().data;
  const [orgNodeId, setOrgNodeId] = useState('');
  const [status, setStatus] = useState('');
  const matrix = useQuery<MatrixRow[]>({
    queryKey: ['documents', 'matrix', orgNodeId, status],
    queryFn: () => api<MatrixRow[]>(`/documents/matrix?${new URLSearchParams({ ...(orgNodeId ? { orgNodeId } : {}), ...(status ? { status } : {}) }).toString()}`),
  });
  const rows = matrix.data ?? [];
  const exportCsv = () => {
    const header = ['Código', 'Título', 'Tipo', 'Revisão', 'Status', 'Classificação', 'Área', 'Responsável', 'Aprovador', 'Publicação', 'Validade'];
    const lines = rows.map((row) =>
      [row.code, row.title, row.typeConfig?.sigla ?? TYPE_LABEL[row.type], `Rev. ${String(Math.max(0, row.version - 1)).padStart(2, '0')}`, STATUS_LABEL[row.status], CONFIDENTIALITY_LABEL[row.confidentiality], row.orgNode?.name, row.owner?.name, row.approver?.name, row.publishedAt ? formatDate(row.publishedAt) : '', row.validUntil ? formatDate(row.validUntil) : '']
        .map(csvCell)
        .join(';'),
    );
    const blob = new Blob([`﻿${[header.join(';'), ...lines].join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lista-mestra-documentos-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 space-y-0 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-base"><Table2 className="h-4 w-4" />Lista mestra</CardTitle>
        <div className="flex flex-wrap gap-2">
          <NativeSelect value={orgNodeId} onChange={(event) => setOrgNodeId(event.target.value)} className="w-48">
            <option value="">Todas as áreas</option>
            {(options?.allOrgNodes ?? []).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
          </NativeSelect>
          <NativeSelect value={status} onChange={(event) => setStatus(event.target.value)} className="w-44">
            <option value="">Todos os status</option>
            {(Object.keys(STATUS_LABEL) as DocStatus[]).map((item) => <option key={item} value={item}>{STATUS_LABEL[item]}</option>)}
          </NativeSelect>
          <Button size="sm" variant="outline" disabled={!rows.length} onClick={exportCsv}><Download className="mr-1.5 h-4 w-4" />Exportar CSV</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-3">Código</th>
                <th className="py-2 pr-3">Título</th>
                <th className="py-2 pr-3">Rev.</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Área</th>
                <th className="py-2 pr-3">Responsável</th>
                <th className="py-2 pr-3">Validade</th>
              </tr>
            </thead>
            <tbody>
              {matrix.isLoading && (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Carregando…</td></tr>
              )}
              {!matrix.isLoading && !rows.length && (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Nenhum documento.</td></tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="py-2 pr-3 font-mono text-xs"><Link href={`/documents/${row.id}`} className="text-primary hover:underline">{row.code}</Link></td>
                  <td className="py-2 pr-3">
                    <Link href={`/documents/${row.id}`} className="hover:underline">{row.title}</Link>
                    {row.confidentiality !== 'INTERNAL' && <Lock className="ml-1 inline h-3 w-3 text-status-yellow" />}
                  </td>
                  <td className="py-2 pr-3 text-xs">{String(Math.max(0, row.version - 1)).padStart(2, '0')}</td>
                  <td className="py-2 pr-3"><StatusBadge status={row.status} /></td>
                  <td className="py-2 pr-3 text-xs">{row.orgNode?.name ?? '—'}</td>
                  <td className="py-2 pr-3 text-xs">{row.owner?.name ?? '—'}</td>
                  <td className={cn('py-2 pr-3 text-xs', row.isExpired && 'font-medium text-status-red')}>{row.validUntil ? formatDate(row.validUntil) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------------- página

function DocumentsHome() {
  const router = useRouter();
  const params = useSearchParams();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['doc:create']);
  const optionsQuery = useDocOptions();
  const canManage = Boolean(optionsQuery.data?.permissions.manage);
  const requestedTab = params.get('tab');
  const [tab, setTab] = useState<Tab>(TABS.includes(requestedTab as Tab) ? (requestedTab as Tab) : 'acervo');
  const [group, setGroup] = useState(params.get('group') ?? '');
  const [createOpen, setCreateOpen] = useState(false);
  const overview = useQuery<Overview>({ queryKey: ['documents', 'overview'], queryFn: () => api<Overview>('/documents/overview') });

  // Links antigos (?doc=, ?id=, ?focus=) abrem a ficha do documento.
  useEffect(() => {
    const legacy = params.get('doc') ?? params.get('id') ?? params.get('focus');
    if (legacy) router.replace(`/documents/${legacy}`);
  }, [params, router]);

  useEffect(() => {
    if (params.get('novo') === '1' && canCreate) setCreateOpen(true);
  }, [params, canCreate]);

  const data = overview.data;
  const pending = data ? data.mine.reads + data.mine.steps + data.mine.changeRequests : 0;
  const openGroup = (value: string) => {
    setGroup(value);
    setTab('acervo');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Documentos"
        eyebrow="Gestão de documentos"
        description="Procedimentos, POPs, instruções e normas com revisão, aprovação assinada, PDF oficial e leitura obrigatória."
        actions={
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <FilePlus2 className="mr-2 h-4 w-4" /> Novo documento
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <button type="button" className="text-left" onClick={() => openGroup('published')}>
          <MetricCard compact title="Vigentes" value={data?.published ?? '—'} icon={<ShieldCheck className="h-4 w-4" />} tone="green" />
        </button>
        <button type="button" className="text-left" onClick={() => openGroup('development')}>
          <MetricCard compact title="Em elaboração" value={data?.development ?? '—'} icon={<PenLine className="h-4 w-4" />} tone="blue" />
        </button>
        <button type="button" className="text-left" onClick={() => openGroup('approval')}>
          <MetricCard compact title="Em revisão ou aprovação" value={data ? data.review + data.approval : '—'} icon={<ClipboardCheck className="h-4 w-4" />} tone="purple" />
        </button>
        <button type="button" className="text-left" onClick={() => openGroup('expired')}>
          <MetricCard compact title="Vencidos ou a revisar" value={data ? `${data.expired} / ${data.needsReview}` : '—'} icon={<CalendarClock className="h-4 w-4" />} tone={data && data.expired > 0 ? 'red' : 'yellow'} />
        </button>
        <button type="button" className="col-span-2 text-left lg:col-span-1" onClick={() => setTab('caixa')}>
          <MetricCard compact title="Minhas pendências" value={data ? pending : '—'} description={data ? `${data.mine.steps} assinatura(s) · ${data.mine.reads} leitura(s)` : undefined} icon={<Inbox className="h-4 w-4" />} tone={pending ? 'yellow' : 'neutral'} />
        </button>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList>
          <TabsTrigger value="acervo"><FileText className="mr-1.5 h-3.5 w-3.5" />Acervo</TabsTrigger>
          <TabsTrigger value="caixa"><Inbox className="mr-1.5 h-3.5 w-3.5" />Minha caixa{pending ? ` (${pending})` : ''}</TabsTrigger>
          <TabsTrigger value="matriz"><Users className="mr-1.5 h-3.5 w-3.5" />Lista mestra</TabsTrigger>
          {canManage && <TabsTrigger value="config"><Settings className="mr-1.5 h-3.5 w-3.5" />Configurações</TabsTrigger>}
        </TabsList>
        <TabsContent value="acervo"><Library initialGroup={group} /></TabsContent>
        <TabsContent value="caixa"><InboxPanel /></TabsContent>
        <TabsContent value="matriz"><MatrixPanel /></TabsContent>
        {canManage && optionsQuery.data && <TabsContent value="config"><DocumentConfig options={optionsQuery.data} /></TabsContent>}
      </Tabs>

      <DocumentCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando documentos…</div>}>
      <DocumentsHome />
    </Suspense>
  );
}
