'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, BadgeCheck, Binary, FileCode2, KeyRound, PackagePlus, RefreshCw, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface RunSummary {
  id: string;
  kind: string;
  status: string;
  updatedAt: string;
}

interface Competence {
  id: string;
  year: number;
  month: number;
  runs: RunSummary[];
}

interface Certificate {
  id: string;
  name: string;
  holderName: string | null;
  holderCpfCnpj: string | null;
  kind: string;
  storageMode: string;
  serialNumber: string | null;
  validUntil: string | null;
  status: string;
  lastTestStatus: string | null;
  hasPfxRef: boolean;
  hasPasswordRef: boolean;
}

interface EsocialEvent {
  id: string;
  eventId: string;
  eventType: string;
  periodRef: string;
  environment: string;
  layoutVersion: string;
  status: string;
  xmlHash: string;
  runId: string | null;
  batchId: string | null;
  issues: string[] | null;
  createdAt: string;
}

interface EsocialBatch {
  id: string;
  status: string;
  eventCount: number;
  environment: string;
  layoutVersion: string;
  periodRef: string | null;
  xmlHash: string | null;
  issues: string[] | null;
  certificate: Certificate | null;
  events: Array<{ id: string; eventId: string; eventType: string; status: string }>;
  createdAt: string;
}

interface BatchXml {
  id: string;
  status: string;
  xml: string | null;
  xmlHash: string | null;
  environment: string;
  layoutVersion: string;
  issues: string[] | null;
}

const STATUS_BADGE: Record<string, string> = {
  XML_GENERATED: 'bg-sky-100 text-sky-800 border-transparent dark:bg-sky-900/30 dark:text-sky-300',
  XML_GENERATED_WITH_WARNINGS: 'bg-amber-100 text-amber-800 border-transparent dark:bg-amber-900/30 dark:text-amber-300',
  BATCHED_UNSIGNED: 'bg-violet-100 text-violet-800 border-transparent dark:bg-violet-900/30 dark:text-violet-300',
  STAGED_UNSIGNED: 'bg-violet-100 text-violet-800 border-transparent dark:bg-violet-900/30 dark:text-violet-300',
  ACTIVE: 'bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-900/30 dark:text-emerald-300',
  WARN: 'bg-amber-100 text-amber-800 border-transparent dark:bg-amber-900/30 dark:text-amber-300',
};

function competenceLabel(year: number, month: number) {
  return `${String(month).padStart(2, '0')}/${year}`;
}

function shortHash(hash: string | null | undefined) {
  return hash ? `${hash.slice(0, 10)}...${hash.slice(-6)}` : '-';
}

export default function PayrollEsocialPage() {
  const qc = useQueryClient();
  const [selectedRun, setSelectedRun] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [selectedCertificate, setSelectedCertificate] = useState('');
  const [certOpen, setCertOpen] = useState(false);
  const [xmlFor, setXmlFor] = useState<string | null>(null);
  const [certForm, setCertForm] = useState({
    name: '',
    holderName: '',
    holderCpfCnpj: '',
    pfxSecretRef: '',
    passwordSecretRef: '',
    validUntil: '',
    notes: '',
  });

  const competencesQuery = useQuery<Competence[]>({
    queryKey: ['payroll-competences'],
    queryFn: () => api<Competence[]>('/payroll/competences'),
  });

  const runs = useMemo(() => {
    return (competencesQuery.data ?? []).flatMap((competence) =>
      competence.runs.map((run) => ({
        ...run,
        label: `${competenceLabel(competence.year, competence.month)} - ${run.kind} - ${run.status}`,
      })),
    );
  }, [competencesQuery.data]);

  const effectiveRun = selectedRun || runs[0]?.id || '';
  const runQuery = effectiveRun ? `?runId=${encodeURIComponent(effectiveRun)}` : '';

  const eventsQuery = useQuery<EsocialEvent[]>({
    queryKey: ['payroll-esocial-events', effectiveRun],
    queryFn: () => api<EsocialEvent[]>(`/payroll/esocial/events${runQuery}`),
    enabled: Boolean(effectiveRun),
  });

  const batchesQuery = useQuery<EsocialBatch[]>({
    queryKey: ['payroll-esocial-batches', effectiveRun],
    queryFn: () => api<EsocialBatch[]>(`/payroll/esocial/batches${runQuery}`),
    enabled: Boolean(effectiveRun),
  });

  const certificatesQuery = useQuery<Certificate[]>({
    queryKey: ['payroll-digital-certificates'],
    queryFn: () => api<Certificate[]>('/payroll/digital-certificates'),
  });

  const xmlQuery = useQuery<BatchXml>({
    queryKey: ['payroll-esocial-batch-xml', xmlFor],
    queryFn: () => api<BatchXml>(`/payroll/esocial/batches/${xmlFor}/xml`),
    enabled: Boolean(xmlFor),
  });

  const generateEvents = useMutation({
    mutationFn: () => api<{ created: number; skipped: unknown[] }>(`/payroll/runs/${effectiveRun}/esocial/events`, { method: 'POST', json: { environment: 'PRODUCTION_RESTRICTED' } }),
    onSuccess: (data) => {
      toast.success(`${data.created} evento(s) eSocial gerado(s).`);
      if (data.skipped.length) toast.warning(`${data.skipped.length} colaborador(es) ficaram pendentes.`);
      setSelectedEvents([]);
      void qc.invalidateQueries({ queryKey: ['payroll-esocial-events', effectiveRun] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao gerar eventos eSocial.'),
  });

  const generateRubricTable = useMutation({
    mutationFn: () => api<{ rubricCount: number }>(`/payroll/runs/${effectiveRun}/esocial/rubric-table`, { method: 'POST', json: { environment: 'PRODUCTION_RESTRICTED' } }),
    onSuccess: (data) => {
      toast.success(`S-1010 gerado com ${data.rubricCount} rubrica(s).`);
      void qc.invalidateQueries({ queryKey: ['payroll-esocial-events', effectiveRun] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao gerar S-1010.'),
  });

  const generateClosing = useMutation({
    mutationFn: () => api<{ created: number }>(`/payroll/runs/${effectiveRun}/esocial/closing`, { method: 'POST', json: { environment: 'PRODUCTION_RESTRICTED' } }),
    onSuccess: () => {
      toast.success('Fechamento S-1299 gerado.');
      void qc.invalidateQueries({ queryKey: ['payroll-esocial-events', effectiveRun] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao gerar S-1299.'),
  });

  const createBatch = useMutation({
    mutationFn: () => api<EsocialBatch>('/payroll/esocial/batches', { method: 'POST', json: { eventIds: selectedEvents, certificateId: selectedCertificate || undefined } }),
    onSuccess: () => {
      toast.success('Lote eSocial interno montado.');
      setSelectedEvents([]);
      void qc.invalidateQueries({ queryKey: ['payroll-esocial-events', effectiveRun] });
      void qc.invalidateQueries({ queryKey: ['payroll-esocial-batches', effectiveRun] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao montar lote eSocial.'),
  });

  const createCertificate = useMutation({
    mutationFn: () => api<Certificate>('/payroll/digital-certificates', { method: 'POST', json: { ...certForm, storageMode: 'EXTERNAL_REF' } }),
    onSuccess: () => {
      toast.success('Referencia de certificado cadastrada.');
      setCertOpen(false);
      setCertForm({ name: '', holderName: '', holderCpfCnpj: '', pfxSecretRef: '', passwordSecretRef: '', validUntil: '', notes: '' });
      void qc.invalidateQueries({ queryKey: ['payroll-digital-certificates'] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao cadastrar certificado.'),
  });

  const testCertificate = useMutation({
    mutationFn: (id: string) => api<{ ok: boolean }>(`/payroll/digital-certificates/${id}/test`, { method: 'POST' }),
    onSuccess: (data) => {
      toast[data.ok ? 'success' : 'warning'](data.ok ? 'Referencia validada.' : 'Referencia com pendencias.');
      void qc.invalidateQueries({ queryKey: ['payroll-digital-certificates'] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao validar certificado.'),
  });

  const events = eventsQuery.data ?? [];
  const freeEvents = events.filter((event) => !event.batchId);
  const batches = batchesQuery.data ?? [];
  const certificates = certificatesQuery.data ?? [];

  const toggleEvent = (id: string) => {
    setSelectedEvents((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/servico-pessoal/folha" className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar para Folha
        </Link>
      </div>

      <PageHeader
        title="eSocial"
        description="Eventos, lotes internos e referencias de certificado digital"
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="h-9 gap-1 px-3">
              <ShieldCheck className="h-4 w-4" /> Produção restrita
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setCertOpen(true)}>
              <KeyRound className="mr-2 h-4 w-4" /> Certificado
            </Button>
            <Button variant="outline" size="icon" onClick={() => {
              void qc.invalidateQueries({ queryKey: ['payroll-esocial-events', effectiveRun] });
              void qc.invalidateQueries({ queryKey: ['payroll-esocial-batches', effectiveRun] });
            }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Eventos</CardTitle>
            <FileCode2 className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{events.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">{freeEvents.length} sem lote</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lotes</CardTitle>
            <PackagePlus className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{batches.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">Sem assinatura/transmissão</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Certificados</CardTitle>
            <KeyRound className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{certificates.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">Somente referencias externas</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Layout</CardTitle>
            <Binary className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">S-1.3</div>
            <p className="mt-1 text-xs text-muted-foreground">S-1010 / S-1200 / S-1299</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Processamento de Origem</CardTitle>
          <CardDescription>Fluxo periódico do período: tabela de rubricas (S-1010) → remuneração (S-1200) → fechamento (S-1299). Tudo em produção restrita, sem assinatura/transmissão.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <NativeSelect value={effectiveRun} onChange={(event) => { setSelectedRun(event.target.value); setSelectedEvents([]); }}>
            {runs.length === 0 && <option value="">Nenhum processamento encontrado</option>}
            {runs.map((run) => <option key={run.id} value={run.id}>{run.label}</option>)}
          </NativeSelect>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => generateRubricTable.mutate()} disabled={!effectiveRun || generateRubricTable.isPending}>
              <Binary className="mr-2 h-4 w-4" /> S-1010 Rubricas
            </Button>
            <Button onClick={() => generateEvents.mutate()} disabled={!effectiveRun || generateEvents.isPending}>
              <FileCode2 className="mr-2 h-4 w-4" /> S-1200 Remuneração
            </Button>
            <Button variant="outline" onClick={() => generateClosing.mutate()} disabled={!effectiveRun || generateClosing.isPending}>
              <PackagePlus className="mr-2 h-4 w-4" /> S-1299 Fechamento
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Eventos Gerados</CardTitle>
              <CardDescription>XML individual com hash e trilha de origem</CardDescription>
            </div>
            <Badge variant="outline">{selectedEvents.length} selecionado(s)</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-y bg-muted/40 text-[10px] uppercase text-muted-foreground">
                  <tr>
                    <th className="w-10 p-3"></th>
                    <th className="p-3">Evento</th>
                    <th className="p-3">Competência</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Hash</th>
                    <th className="p-3">Avisos</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {eventsQuery.isLoading && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando eventos...</td></tr>}
                  {!eventsQuery.isLoading && events.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum evento gerado para este processamento.</td></tr>}
                  {events.map((event) => (
                    <tr key={event.id} className="hover:bg-muted/20">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border"
                          checked={selectedEvents.includes(event.id)}
                          disabled={Boolean(event.batchId)}
                          onChange={() => toggleEvent(event.id)}
                          aria-label={`Selecionar ${event.eventId}`}
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-semibold">{event.eventType}</div>
                        <div className="mt-0.5 max-w-[220px] truncate font-mono text-[10px] text-muted-foreground">{event.eventId}</div>
                      </td>
                      <td className="p-3">{event.periodRef}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={cn('text-[10px]', STATUS_BADGE[event.status])}>{event.status}</Badge>
                      </td>
                      <td className="p-3 font-mono text-[10px]">{shortHash(event.xmlHash)}</td>
                      <td className="p-3 text-muted-foreground">{event.issues?.length ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Montar Lote</CardTitle>
            <CardDescription>Empacota eventos selecionados em envelope interno</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Label>Certificado</Label>
              <NativeSelect value={selectedCertificate} onChange={(event) => setSelectedCertificate(event.target.value)}>
                <option value="">Sem certificado</option>
                {certificates.map((cert) => <option key={cert.id} value={cert.id}>{cert.name}</option>)}
              </NativeSelect>
            </div>
            <Button className="w-full" onClick={() => createBatch.mutate()} disabled={selectedEvents.length === 0 || createBatch.isPending}>
              <PackagePlus className="mr-2 h-4 w-4" /> Criar lote interno
            </Button>
            <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
              Status final esperado: <span className="font-semibold text-foreground">STAGED_UNSIGNED</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Lotes Internos</CardTitle>
          <CardDescription>Conferência, hash e XML consolidado</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-y bg-muted/40 text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Criado em</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Eventos</th>
                  <th className="p-3">Certificado</th>
                  <th className="p-3">Hash</th>
                  <th className="p-3 text-right">XML</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {batchesQuery.isLoading && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando lotes...</td></tr>}
                {!batchesQuery.isLoading && batches.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum lote montado.</td></tr>}
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-muted/20">
                    <td className="p-3">{new Date(batch.createdAt).toLocaleString('pt-BR')}</td>
                    <td className="p-3"><Badge variant="outline" className={cn('text-[10px]', STATUS_BADGE[batch.status])}>{batch.status}</Badge></td>
                    <td className="p-3">{batch.eventCount}</td>
                    <td className="p-3">{batch.certificate?.name ?? '-'}</td>
                    <td className="p-3 font-mono text-[10px]">{shortHash(batch.xmlHash)}</td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setXmlFor(batch.id)}>
                        Ver XML
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Certificados Referenciados</CardTitle>
          <CardDescription>Metadados e referências externas; segredo nunca é retornado</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {certificates.length === 0 && <div className="text-sm text-muted-foreground">Nenhum certificado referenciado.</div>}
          {certificates.map((cert) => (
            <div key={cert.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{cert.name}</div>
                <Badge variant="outline" className={cn('text-[10px]', STATUS_BADGE[cert.status])}>{cert.status}</Badge>
              </div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <div>{cert.holderName || 'Titular não informado'}</div>
                <div>Validade: {cert.validUntil ? new Date(cert.validUntil).toLocaleDateString('pt-BR') : '-'}</div>
                <div>PFX: {cert.hasPfxRef ? 'referenciado' : 'ausente'} · Senha: {cert.hasPasswordRef ? 'referenciada' : 'ausente'}</div>
              </div>
              <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => testCertificate.mutate(cert.id)} disabled={testCertificate.isPending}>
                <BadgeCheck className="mr-2 h-4 w-4" /> Validar referência
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={certOpen} onOpenChange={setCertOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Referenciar Certificado A1</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={certForm.name} onChange={(event) => setCertForm({ ...certForm, name: event.target.value })} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Titular</Label>
                <Input value={certForm.holderName} onChange={(event) => setCertForm({ ...certForm, holderName: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>CPF/CNPJ titular</Label>
                <Input value={certForm.holderCpfCnpj} onChange={(event) => setCertForm({ ...certForm, holderCpfCnpj: event.target.value })} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Referência do PFX</Label>
                <Input value={certForm.pfxSecretRef} onChange={(event) => setCertForm({ ...certForm, pfxSecretRef: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Referência da senha</Label>
                <Input value={certForm.passwordSecretRef} onChange={(event) => setCertForm({ ...certForm, passwordSecretRef: event.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Validade</Label>
              <Input type="date" value={certForm.validUntil} onChange={(event) => setCertForm({ ...certForm, validUntil: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCertOpen(false)}>Cancelar</Button>
            <Button onClick={() => createCertificate.mutate()} disabled={!certForm.name.trim() || createCertificate.isPending}>Salvar referência</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(xmlFor)} onOpenChange={(open) => !open && setXmlFor(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>XML do Lote</DialogTitle>
          </DialogHeader>
          <Textarea readOnly value={xmlQuery.data?.xml ?? ''} className="min-h-[420px] font-mono text-xs" />
          <DialogFooter>
            <Badge variant="outline" className="mr-auto font-mono">{shortHash(xmlQuery.data?.xmlHash)}</Badge>
            <Button variant="outline" onClick={() => setXmlFor(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
