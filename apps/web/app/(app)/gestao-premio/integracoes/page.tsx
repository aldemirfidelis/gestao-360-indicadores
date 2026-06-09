'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plug, Plus, PlayCircle, CheckCircle2, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

interface Connector {
  id: string; kind: string; name: string; type: string; active: boolean; hasSecret?: boolean;
  lastStatus: string | null; lastRunAt: string | null; processedTotal: number; _count: { jobs: number };
}
interface Job { id: string; kind: string; type: string; status: string; processed: number; lotVersion: number; createdAt: string; competenceId: string | null }

const KIND_LABEL: Record<string, string> = { APDATA_ELIGIBLE: 'Apdata — Base elegível', APDATA_EVENTS: 'Apdata — Eventos', BSC: 'BSC', PAYROLL: 'Folha de Pagamento' };
const TYPE_LABEL: Record<string, string> = { API: 'API', FILE_CSV: 'Arquivo CSV', FILE_XLSX: 'Arquivo XLSX', DB_BRIDGE: 'Banco intermediário', MANUAL: 'Manual' };
const JOB_STATUS: Record<string, any> = { SUCCESS: 'default', RUNNING: 'secondary', ERROR: 'destructive', PARTIAL: 'outline', PENDING: 'secondary' };

const emptyForm = { kind: 'APDATA_ELIGIBLE', name: '', type: 'MANUAL', secretRef: '', endpoint: '', active: true };

export default function PrizeConnectorsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canAdmin = hasPermission(['prize:admin']);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: connectors = [] } = useQuery({ queryKey: ['prize-connectors'], queryFn: () => api<Connector[]>('/prize/eligible/connectors') });
  const { data: jobs = [] } = useQuery({ queryKey: ['prize-jobs'], queryFn: () => api<Job[]>('/prize/eligible/jobs') });

  const create = useMutation({
    mutationFn: () => api('/prize/eligible/connectors', { method: 'POST', json: {
      kind: form.kind, name: form.name, type: form.type, active: form.active,
      secretRef: form.secretRef || null, config: form.endpoint ? { endpoint: form.endpoint } : undefined,
    } }),
    onSuccess: () => { toast.success('Conector criado'); qc.invalidateQueries({ queryKey: ['prize-connectors'] }); setOpen(false); setForm(emptyForm); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const test = useMutation({
    mutationFn: (id: string) => api<{ ok: boolean; checks: any[] }>(`/prize/eligible/connectors/${id}/test`, { method: 'POST' }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['prize-connectors'] });
      if (r.ok) toast.success('Conector OK'); else toast.warning(r.checks.filter((c) => !c.ok).map((c) => c.detail).join(' · '));
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Integrações do Prêmio"
        eyebrow="Gestão de Prêmio"
        description="Conectores desacoplados (Apdata, BSC, Folha). Segredos por referência de ambiente — nunca armazenados em claro."
        tone="view"
        breadcrumbs={[{ label: 'Gestão de Prêmio', href: '/gestao-premio' }, { label: 'Integrações' }]}
        actions={canAdmin ? <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Novo conector</Button> : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Conectores</h2>
          {connectors.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <Plug className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhum conector configurado. Sem conector, use a importação assistida por arquivo/mock.</p>
            </CardContent></Card>
          ) : connectors.map((c) => (
            <Card key={c.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      <Badge variant={c.active ? 'default' : 'outline'}>{c.active ? 'Ativo' : 'Inativo'}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{KIND_LABEL[c.kind] ?? c.kind} · {TYPE_LABEL[c.type] ?? c.type}</p>
                  </div>
                  {c.lastStatus && <Badge variant={c.lastStatus === 'OK' ? 'default' : 'outline'}>{c.lastStatus}</Badge>}
                </div>
                <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                  <span>{c.hasSecret ? 'Credencial referenciada' : 'Sem credencial'}</span>
                  <span>{c._count.jobs} job(s)</span>
                  <span>{c.processedTotal} processados</span>
                </div>
                {canAdmin && <Button size="sm" variant="outline" onClick={() => test.mutate(c.id)} disabled={test.isPending}><PlayCircle className="mr-1 h-3.5 w-3.5" />Testar</Button>}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Jobs recentes</h2>
          <Card>
            <CardContent className="p-0">
              {jobs.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Nenhum job executado.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {jobs.map((j) => (
                    <li key={j.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        {j.status === 'SUCCESS' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : j.status === 'ERROR' ? <XCircle className="h-4 w-4 text-red-600" /> : <PlayCircle className="h-4 w-4 text-muted-foreground" />}
                        <span>{KIND_LABEL[j.kind] ?? j.kind} <span className="text-xs text-muted-foreground">v{j.lotVersion} · {j.processed} reg.</span></span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge variant={JOB_STATUS[j.status] ?? 'secondary'}>{j.status}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(j.createdAt).toLocaleString('pt-BR')}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo conector</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Origem</Label>
                <NativeSelect value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </NativeSelect>
              </div>
              <div><Label>Tipo</Label>
                <NativeSelect value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </NativeSelect>
              </div>
            </div>
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Apdata Produção" /></div>
            <div><Label>Endpoint (se API)</Label><Input value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} placeholder="https://…" /></div>
            <div>
              <Label>Referência da credencial (variável de ambiente)</Label>
              <Input value={form.secretRef} onChange={(e) => setForm({ ...form, secretRef: e.target.value })} placeholder="Ex.: APDATA_API_TOKEN" />
              <p className="mt-1 text-xs text-muted-foreground">O segredo não é armazenado — guardamos apenas o nome da variável.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !form.name.trim()}>{create.isPending ? 'Criando…' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
