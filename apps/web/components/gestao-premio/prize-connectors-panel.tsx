'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Plug, PlayCircle, Plus, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { api, ApiError } from '@/lib/api';

interface Connector {
  id: string;
  kind: string;
  name: string;
  type: string;
  active: boolean;
  hasSecret?: boolean;
  lastStatus: string | null;
  lastRunAt: string | null;
  processedTotal: number;
  _count: { jobs: number };
}

interface Job {
  id: string;
  kind: string;
  type: string;
  status: string;
  processed: number;
  lotVersion: number;
  createdAt: string;
  competenceId: string | null;
}

interface PrizeConnectorsPanelProps {
  embedded?: boolean;
  canAdmin?: boolean;
}

const KIND_LABEL: Record<string, string> = {
  APDATA_ELIGIBLE: 'Apdata - Base elegivel',
  APDATA_EVENTS: 'Apdata - Eventos',
  PAYROLL: 'Folha de Pagamento',
};
const TYPE_LABEL: Record<string, string> = {
  API: 'API',
  FILE_CSV: 'Arquivo CSV',
  FILE_XLSX: 'Arquivo XLSX',
  DB_BRIDGE: 'Banco intermediario',
  MANUAL: 'Manual',
};
const JOB_STATUS: Record<string, any> = {
  SUCCESS: 'default',
  RUNNING: 'secondary',
  ERROR: 'destructive',
  PARTIAL: 'outline',
  PENDING: 'secondary',
};
const JOB_STATUS_LABEL: Record<string, string> = {
  SUCCESS: 'Sucesso',
  RUNNING: 'Em execucao',
  ERROR: 'Erro',
  PARTIAL: 'Parcial',
  PENDING: 'Pendente',
};

const emptyForm = { kind: 'APDATA_ELIGIBLE', name: '', type: 'MANUAL', secretRef: '', endpoint: '', active: true };

export function PrizeConnectorsPanel({ embedded = false, canAdmin = true }: PrizeConnectorsPanelProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: connectors = [] } = useQuery({
    queryKey: ['prize-connectors'],
    queryFn: () => api<Connector[]>('/prize/eligible/connectors'),
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ['prize-jobs'],
    queryFn: () => api<Job[]>('/prize/eligible/jobs'),
  });

  const create = useMutation({
    mutationFn: () =>
      api('/prize/eligible/connectors', {
        method: 'POST',
        json: {
          kind: form.kind,
          name: form.name,
          type: form.type,
          active: form.active,
          secretRef: form.secretRef || null,
          config: form.endpoint ? { endpoint: form.endpoint } : undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Conector criado');
      qc.invalidateQueries({ queryKey: ['prize-connectors'] });
      setOpen(false);
      setForm(emptyForm);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const test = useMutation({
    mutationFn: (id: string) => api<{ ok: boolean; checks: Array<{ ok: boolean; detail: string }> }>(`/prize/eligible/connectors/${id}/test`, { method: 'POST' }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['prize-connectors'] });
      if (result.ok) {
        toast.success('Conector OK');
      } else {
        toast.warning(result.checks.filter((check) => !check.ok).map((check) => check.detail).join(' | '));
      }
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  return (
    <div>
      {embedded ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b pb-4">
          <div>
            <h2 className="text-base font-semibold">Integracoes do Premio</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Conectores Apdata e Folha no contexto da empresa selecionada no Portal Global.
            </p>
          </div>
          {canAdmin && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Novo conector
            </Button>
          )}
        </div>
      ) : (
        <PageHeader
          title="Integracoes do Premio"
          eyebrow="Gestao de Premio"
          description="Conectores desacoplados para Apdata e Folha. Segredos ficam apenas como referencia de ambiente."
          tone="view"
          breadcrumbs={[{ label: 'Gestao de Premio', href: '/gestao-premio' }, { label: 'Integracoes' }]}
          actions={
            canAdmin ? (
              <Button onClick={() => setOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Novo conector
              </Button>
            ) : undefined
          }
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Conectores</h2>
          {connectors.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <Plug className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Nenhum conector configurado. Sem conector, use importacao assistida por arquivo.</p>
              </CardContent>
            </Card>
          ) : (
            connectors.map((connector) => (
              <Card key={connector.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{connector.name}</span>
                        <Badge variant={connector.active ? 'default' : 'outline'}>{connector.active ? 'Ativo' : 'Inativo'}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {KIND_LABEL[connector.kind] ?? 'Legado'} | {TYPE_LABEL[connector.type] ?? connector.type}
                      </p>
                    </div>
                    {connector.lastStatus && <Badge variant={connector.lastStatus === 'OK' ? 'default' : 'outline'}>{connector.lastStatus}</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                    <span>{connector.hasSecret ? 'Credencial referenciada' : 'Sem credencial'}</span>
                    <span>{connector._count.jobs} rotina(s)</span>
                    <span>{connector.processedTotal} processados</span>
                  </div>
                  {canAdmin && (
                    <Button size="sm" variant="outline" onClick={() => test.mutate(connector.id)} disabled={test.isPending}>
                      <PlayCircle className="mr-1 h-3.5 w-3.5" />
                      Testar
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Rotinas recentes</h2>
          <Card>
            <CardContent className="p-0">
              {jobs.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Nenhum job executado.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {jobs.map((job) => (
                    <li key={job.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        {job.status === 'SUCCESS' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : job.status === 'ERROR' ? (
                          <XCircle className="h-4 w-4 text-red-600" />
                        ) : (
                          <PlayCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span>
                          {KIND_LABEL[job.kind] ?? 'Legado'}{' '}
                          <span className="text-xs text-muted-foreground">
                            v{job.lotVersion} | {job.processed} reg.
                          </span>
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge variant={JOB_STATUS[job.status] ?? 'secondary'}>{JOB_STATUS_LABEL[job.status] ?? job.status}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(job.createdAt).toLocaleString('pt-BR')}</span>
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
          <DialogHeader>
            <DialogTitle>Novo conector</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Origem</Label>
                <NativeSelect value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
                  {Object.entries(KIND_LABEL).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label>Tipo</Label>
                <NativeSelect value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                  {Object.entries(TYPE_LABEL).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Apdata Producao" />
            </div>
            <div>
              <Label>Endereco (se API)</Label>
              <Input value={form.endpoint} onChange={(event) => setForm({ ...form, endpoint: event.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label>Referencia da credencial (variavel de ambiente)</Label>
              <Input value={form.secretRef} onChange={(event) => setForm({ ...form, secretRef: event.target.value })} placeholder="Ex.: APDATA_API_TOKEN" />
              <p className="mt-1 text-xs text-muted-foreground">O segredo nao e armazenado. Guardamos apenas o nome da variavel.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !form.name.trim()}>
              {create.isPending ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
