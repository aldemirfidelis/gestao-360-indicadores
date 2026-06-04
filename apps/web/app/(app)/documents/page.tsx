'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, CheckCircle2, Edit, FileText, Filter, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';

type DocStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'OBSOLETE';
type DocType = 'POLICY' | 'PROCEDURE' | 'INSTRUCTION' | 'MANUAL' | 'FORM' | 'TEMPLATE' | 'RECORD' | 'EXTERNAL' | 'OTHER';

interface Doc {
  id: string;
  number: number;
  code: string | null;
  title: string;
  description: string | null;
  type: DocType;
  status: DocStatus;
  version: number;
  content: string | null;
  externalUrl: string | null;
  changeNote: string | null;
  validFrom: string | null;
  validUntil: string | null;
  reviewIntervalMonths: number | null;
  approvedAt: string | null;
  publishedAt: string | null;
  isExpired: boolean;
  needsReview: boolean;
  daysToExpire: number | null;
  orgNodeId: string | null;
  indicatorId: string | null;
  ownerUserId: string | null;
  approverUserId: string | null;
  orgNode: { id: string; name: string; type: string } | null;
  indicator: { id: string; name: string; code: string | null; ownerNodeId: string } | null;
  owner: { id: string; name: string; email: string } | null;
  approver: { id: string; name: string; email: string } | null;
}

interface DocSummary {
  total: number;
  published: number;
  draft: number;
  expired: number;
  needsReview: number;
  expiringSoon: Array<Pick<Doc, 'id' | 'number' | 'code' | 'title' | 'type' | 'status' | 'validUntil' | 'isExpired' | 'daysToExpire' | 'orgNode' | 'owner'>>;
}

interface DocOptions {
  orgNodes: Array<{ id: string; name: string; type: string }>;
  indicators: Array<{ id: string; name: string; code: string | null; ownerNodeId: string }>;
  users: Array<{ id: string; name: string; email: string; defaultNodeId: string | null }>;
  statuses: DocStatus[];
  types: DocType[];
}

interface DocForm {
  title: string;
  code: string;
  description: string;
  type: DocType;
  status: DocStatus;
  version: string;
  content: string;
  externalUrl: string;
  changeNote: string;
  orgNodeId: string;
  indicatorId: string;
  ownerUserId: string;
  approverUserId: string;
  validFrom: string;
  validUntil: string;
  reviewIntervalMonths: string;
}

const STATUS_LABEL: Record<DocStatus, string> = {
  DRAFT: 'Rascunho',
  REVIEW: 'Em revisao',
  APPROVED: 'Aprovado',
  PUBLISHED: 'Publicado',
  OBSOLETE: 'Obsoleto',
};

const TYPE_LABEL: Record<DocType, string> = {
  POLICY: 'Politica',
  PROCEDURE: 'Procedimento',
  INSTRUCTION: 'Instrucao',
  MANUAL: 'Manual',
  FORM: 'Formulario',
  TEMPLATE: 'Modelo',
  RECORD: 'Registro',
  EXTERNAL: 'Externo',
  OTHER: 'Outro',
};

const STATUS_CLASS: Record<DocStatus, string> = {
  DRAFT: 'border-border text-muted-foreground',
  REVIEW: 'border-status-blue/30 text-status-blue',
  APPROVED: 'border-status-purple/30 text-status-purple',
  PUBLISHED: 'border-status-green/30 text-status-green',
  OBSOLETE: 'border-border text-muted-foreground line-through',
};

const EMPTY_FORM: DocForm = {
  title: '',
  code: '',
  description: '',
  type: 'PROCEDURE',
  status: 'DRAFT',
  version: '1',
  content: '',
  externalUrl: '',
  changeNote: '',
  orgNodeId: '',
  indicatorId: '',
  ownerUserId: '',
  approverUserId: '',
  validFrom: '',
  validUntil: '',
  reviewIntervalMonths: '',
};

export default function DocumentsPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['doc:create']);
  const canUpdate = hasPermission(['doc:update']);
  const canDelete = hasPermission(['doc:delete']);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [filters, setFilters] = useState({ search: '', status: '', type: '' });
  const [form, setForm] = useState<DocForm>(EMPTY_FORM);

  const listQuery = useQuery<Doc[]>({
    queryKey: ['documents', filters],
    queryFn: () => api<Doc[]>(`/documents${toQueryString(filters)}`),
  });
  const summaryQuery = useQuery<DocSummary>({
    queryKey: ['documents', 'summary'],
    queryFn: () => api<DocSummary>('/documents/summary'),
  });
  const optionsQuery = useQuery<DocOptions>({
    queryKey: ['documents', 'options'],
    queryFn: () => api<DocOptions>('/documents/options'),
    staleTime: 60_000,
  });

  const items = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const summary = summaryQuery.data;
  const options = optionsQuery.data;

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        code: form.code || null,
        description: form.description || null,
        type: form.type,
        status: form.status,
        version: Number(form.version) || 1,
        content: form.content || null,
        externalUrl: form.externalUrl || null,
        changeNote: form.changeNote || null,
        orgNodeId: form.orgNodeId || null,
        indicatorId: form.indicatorId || null,
        ownerUserId: form.ownerUserId || null,
        approverUserId: form.approverUserId || null,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
        reviewIntervalMonths: form.reviewIntervalMonths ? Number(form.reviewIntervalMonths) : null,
      };
      return editing
        ? api<Doc>(`/documents/${editing.id}`, { method: 'PATCH', json: payload })
        : api<Doc>('/documents', { method: 'POST', json: payload });
    },
    onSuccess: () => {
      toast.success(editing ? 'Documento atualizado' : 'Documento criado');
      closeDialog();
      invalidate(qc);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel salvar o documento'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api<Doc>(`/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Documento excluido');
      invalidate(qc);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel excluir o documento'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (doc: Doc) => {
    setEditing(doc);
    setForm({
      title: doc.title,
      code: doc.code ?? '',
      description: doc.description ?? '',
      type: doc.type,
      status: doc.status,
      version: String(doc.version ?? 1),
      content: doc.content ?? '',
      externalUrl: doc.externalUrl ?? '',
      changeNote: doc.changeNote ?? '',
      orgNodeId: doc.orgNodeId ?? '',
      indicatorId: doc.indicatorId ?? '',
      ownerUserId: doc.ownerUserId ?? '',
      approverUserId: doc.approverUserId ?? '',
      validFrom: toInputDate(doc.validFrom),
      validUntil: toInputDate(doc.validUntil),
      reviewIntervalMonths: doc.reviewIntervalMonths ? String(doc.reviewIntervalMonths) : '',
    });
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const focusId = searchParams.get('focus');
  const focusedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusId || focusedRef.current === focusId) return;
    const target = items.find((d) => d.id === focusId);
    if (target) {
      focusedRef.current = focusId;
      openEdit(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, items]);

  return (
    <div>
      <PageHeader
        title="Documentos"
        description="Gestao documental: politicas, procedimentos, validade, aprovacao e revisao."
        actions={canCreate ? <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo documento</Button> : null}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Publicados" value={formatNumber(summary?.published)} description={`${formatNumber(summary?.total)} no acervo`} icon={<FileText className="h-4 w-4" />} tone="green" />
        <MetricCard title="Em elaboracao" value={formatNumber(summary?.draft)} description="Rascunho ou em revisao" icon={<Edit className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Vencidos" value={formatNumber(summary?.expired)} description="Publicados fora da validade" icon={<CalendarClock className="h-4 w-4" />} tone={(summary?.expired ?? 0) > 0 ? 'red' : 'green'} />
        <MetricCard title="A revisar" value={formatNumber(summary?.needsReview)} description="Vencem em ate 30 dias" icon={<RotateCcw className="h-4 w-4" />} tone={(summary?.needsReview ?? 0) > 0 ? 'yellow' : 'green'} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr,360px]">
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">Validade / revisao</div>
                <div className="text-xs text-muted-foreground">Documentos vencidos ou proximos da revisao.</div>
              </div>
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              {(summary?.expiringSoon ?? []).length === 0 && (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Nenhum documento a vencer.</div>
              )}
              {(summary?.expiringSoon ?? []).map((doc) => (
                <div key={doc.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{doc.code ? `${doc.code} · ` : ''}{doc.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{TYPE_LABEL[doc.type]} - {doc.owner?.name ?? 'Sem dono'} - validade {formatDate(doc.validUntil)}</div>
                  </div>
                  <Badge variant="outline" className={doc.isExpired ? 'border-status-red/40 text-status-red' : 'border-status-yellow/40 text-status-yellow'}>
                    {doc.isExpired ? 'Vencido' : `${doc.daysToExpire}d`}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Filter className="h-4 w-4" />Filtros</div>
            <div className="space-y-3">
              <Input placeholder="Buscar por titulo, codigo, conteudo..." value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
              <NativeSelect value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                <option value="">Todos os status</option>
                {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
              <NativeSelect value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
                <option value="">Todos os tipos</option>
                {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
              {(filters.search || filters.status || filters.type) && (
                <Button variant="ghost" size="sm" onClick={() => setFilters({ search: '', status: '', type: '' })}>
                  <X className="mr-2 h-4 w-4" />Limpar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {items.length === 0 && (
          <Card className="xl:col-span-2">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {listQuery.isLoading ? 'Carregando documentos...' : 'Nenhum documento encontrado para os filtros atuais.'}
            </CardContent>
          </Card>
        )}
        {items.map((doc) => (
          <Card key={doc.id} className={cn('overflow-hidden', doc.isExpired && 'border-status-red/40', doc.needsReview && !doc.isExpired && 'border-status-yellow/50')}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{doc.code ? doc.code : `#${doc.number}`}</Badge>
                    <Badge variant="outline" className={STATUS_CLASS[doc.status]}>{STATUS_LABEL[doc.status]}</Badge>
                    <Badge variant="secondary">{TYPE_LABEL[doc.type]}</Badge>
                    <Badge variant="outline">v{doc.version}</Badge>
                  </div>
                  <h2 className="mt-3 truncate text-base font-semibold">{doc.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{doc.description || 'Sem descricao registrada.'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {canUpdate && <Button variant="ghost" size="icon" onClick={() => openEdit(doc)} title="Editar documento"><Edit className="h-4 w-4" /></Button>}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.confirm('Excluir este documento?') && remove.mutate(doc.id)}
                      disabled={remove.isPending}
                      title="Excluir documento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div>Area/processo: <span className="text-foreground">{doc.orgNode?.name ?? '-'}</span></div>
                <div>Dono: <span className="text-foreground">{doc.owner?.name ?? '-'}</span></div>
                <div>Aprovador: <span className="text-foreground">{doc.approver?.name ?? '-'}</span></div>
                <div>Validade: <span className={cn('text-foreground', doc.isExpired && 'text-status-red')}>{formatDate(doc.validUntil)}</span></div>
              </div>

              {doc.externalUrl && (
                <a href={doc.externalUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <FileText className="h-3.5 w-3.5" /> Abrir arquivo externo
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar documento #${editing.number}` : 'Novo documento'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Titulo</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>Codigo</Label>
              <Input placeholder="POL-001" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <Label>Tipo</Label>
              <NativeSelect value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as DocType }))}>
                {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Status</Label>
              <NativeSelect value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as DocStatus }))}>
                {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Versao</Label>
              <Input type="number" min={1} value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} />
            </div>
            <div>
              <Label>Area/processo</Label>
              <NativeSelect value={form.orgNodeId} onChange={(e) => setForm((f) => ({ ...f, orgNodeId: e.target.value }))}>
                <option value="">Sem area direta</option>
                {(options?.orgNodes ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Indicador relacionado</Label>
              <NativeSelect value={form.indicatorId} onChange={(e) => setForm((f) => ({ ...f, indicatorId: e.target.value }))}>
                <option value="">Sem indicador</option>
                {(options?.indicators ?? []).map((item) => <option key={item.id} value={item.id}>{item.code ? `[${item.code}] ` : ''}{item.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Dono</Label>
              <NativeSelect value={form.ownerUserId} onChange={(e) => setForm((f) => ({ ...f, ownerUserId: e.target.value }))}>
                <option value="">Sem dono</option>
                {(options?.users ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Aprovador</Label>
              <NativeSelect value={form.approverUserId} onChange={(e) => setForm((f) => ({ ...f, approverUserId: e.target.value }))}>
                <option value="">Sem aprovador</option>
                {(options?.users ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Vigencia (inicio)</Label>
              <Input type="date" value={form.validFrom} onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))} />
            </div>
            <div>
              <Label>Validade / proxima revisao</Label>
              <Input type="date" value={form.validUntil} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} />
            </div>
            <div>
              <Label>Intervalo de revisao (meses)</Label>
              <Input type="number" min={1} value={form.reviewIntervalMonths} onChange={(e) => setForm((f) => ({ ...f, reviewIntervalMonths: e.target.value }))} />
            </div>
            <div>
              <Label>URL do arquivo (externo)</Label>
              <Input placeholder="https://..." value={form.externalUrl} onChange={(e) => setForm((f) => ({ ...f, externalUrl: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Descricao</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Conteudo (markdown, para documentos nativos)</Label>
              <Textarea rows={4} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Nota de alteracao (changelog)</Label>
              <Input value={form.changeNote} onChange={(e) => setForm((f) => ({ ...f, changeNote: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim()}>
              {save.isPending ? 'Salvando...' : 'Salvar documento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toQueryString(filters: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

function toInputDate(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['documents'] });
}
