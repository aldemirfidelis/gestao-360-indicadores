'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShieldCheck, CheckCircle2, XCircle, RotateCcw, AlertTriangle, ClipboardCheck, Lock } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

const ALLOWED_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'DIRECTOR', 'MANAGER'];

interface ActionRow {
  id: string;
  title: string;
  status: string;
  effectivenessStatus: string;
  priority: string;
  criticality: string;
  dueDate: string | null;
  completedAt: string | null;
  achievedResult: string | null;
  expectedResult: string | null;
  effectivenessSummary: string | null;
  effectivenessEvidence: string | null;
  responsibleUser: { id: string; name: string } | null;
  ownerNode: { id: string; name: string } | null;
  indicator: { id: string; name: string; code: string | null } | null;
}

const EFFECTIVENESS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Nao iniciado',
  PENDING: 'Pendente analise',
  IN_REVIEW: 'Em analise',
  EFFECTIVE: 'Eficaz',
  INEFFECTIVE: 'Ineficaz',
  REOPENED: 'Reaberto',
  NOT_APPLICABLE: 'N/A',
};

const STATUS_PILL: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-300',
  IN_REVIEW: 'bg-sky-100 text-sky-800 border-sky-300',
  EFFECTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  INEFFECTIVE: 'bg-rose-100 text-rose-800 border-rose-300',
  REOPENED: 'bg-purple-100 text-purple-800 border-purple-300',
  NOT_STARTED: 'bg-gray-100 text-gray-700 border-gray-300',
  NOT_APPLICABLE: 'bg-gray-100 text-gray-700 border-gray-300',
};

export default function EficaciaPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const allowed = !!user && ALLOWED_ROLES.includes(user.role);

  const [filter, setFilter] = useState<'PENDING' | 'IN_REVIEW' | 'EFFECTIVE' | 'INEFFECTIVE' | 'ALL'>('PENDING');
  const [dialog, setDialog] = useState<{ open: boolean; row: ActionRow | null }>({ open: false, row: null });
  const [form, setForm] = useState({ effective: true, reopen: false, summary: '', evidence: '', achievedResult: '' });

  const query = useQuery<ActionRow[]>({
    queryKey: ['actions', 'eficacia', filter],
    queryFn: () => {
      const q = filter === 'ALL' ? '' : `?effectivenessStatus=${filter}`;
      return api<ActionRow[]>(`/actions${q}`);
    },
    enabled: allowed,
  });

  const validate = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      api(`/actions/${id}/effectiveness`, { method: 'POST', json: body }),
    onSuccess: () => {
      toast.success('Eficacia registrada');
      setDialog({ open: false, row: null });
      qc.invalidateQueries({ queryKey: ['actions', 'eficacia'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao registrar eficacia'),
  });

  const openDialog = (row: ActionRow) => {
    setForm({
      effective: row.effectivenessStatus === 'EFFECTIVE',
      reopen: false,
      summary: row.effectivenessSummary ?? '',
      evidence: row.effectivenessEvidence ?? '',
      achievedResult: row.achievedResult ?? '',
    });
    setDialog({ open: true, row });
  };

  const submit = () => {
    if (!dialog.row) return;
    validate.mutate({ id: dialog.row.id, body: form });
  };

  const actions = query.data ?? [];
  const stats = useMemo(() => ({
    pending: actions.filter((a) => ['PENDING', 'IN_REVIEW', 'REOPENED'].includes(a.effectivenessStatus)).length,
    effective: actions.filter((a) => a.effectivenessStatus === 'EFFECTIVE').length,
    ineffective: actions.filter((a) => a.effectivenessStatus === 'INEFFECTIVE').length,
    total: actions.length,
  }), [actions]);

  if (!user) return null;
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Analise de Eficacia" description="Validacao de eficacia dos planos de acao." />
        <Card className="mt-6">
          <CardContent className="py-12 text-center space-y-3">
            <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
            <div className="text-lg font-semibold">Acesso restrito</div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Apenas usuarios com perfil SUPER_ADMIN, COMPANY_ADMIN, DIRECTOR ou MANAGER podem realizar a Analise de Eficacia.
            </p>
            <p className="text-xs text-muted-foreground">
              Seu perfil atual: <span className="font-mono">{user.role}</span>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Analise de Eficacia"
        description="Validacao formal de que as acoes resolveram o problema e atingiram o resultado esperado."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard title="Aguardando analise" value={String(stats.pending)} description="Pendente / em analise / reaberto" icon={<ClipboardCheck className="h-4 w-4" />} tone="yellow" />
        <MetricCard title="Eficazes" value={String(stats.effective)} description="Acoes validadas" icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
        <MetricCard title="Ineficazes" value={String(stats.ineffective)} description="Resultado nao atingido" icon={<XCircle className="h-4 w-4" />} tone="red" />
        <MetricCard title="No filtro" value={String(stats.total)} description="Total exibido" icon={<ShieldCheck className="h-4 w-4" />} tone="blue" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(['PENDING', 'IN_REVIEW', 'EFFECTIVE', 'INEFFECTIVE', 'ALL'] as const).map((s) => (
          <Button key={s} variant={filter === s ? 'default' : 'outline'} size="sm" onClick={() => setFilter(s)}>
            {s === 'ALL' ? 'Todas' : EFFECTIVENESS_LABEL[s]}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Acao</th>
                <th className="p-3 text-left">Indicador</th>
                <th className="p-3 text-left">Responsavel</th>
                <th className="p-3 text-center">Status acao</th>
                <th className="p-3 text-center">Eficacia</th>
                <th className="p-3 text-center">Concluida em</th>
                <th className="p-3 text-center">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id} className="border-b hover:bg-muted/20 transition">
                  <td className="p-3">
                    <Link href={`/actions/${a.id}`} className="font-semibold hover:underline">
                      {a.title}
                    </Link>
                    {a.ownerNode && <div className="text-[11px] text-muted-foreground">{a.ownerNode.name}</div>}
                  </td>
                  <td className="p-3 text-xs">
                    {a.indicator ? (
                      <>
                        {a.indicator.code && <span className="font-mono text-muted-foreground mr-1">[{a.indicator.code}]</span>}
                        {a.indicator.name}
                      </>
                    ) : '—'}
                  </td>
                  <td className="p-3 text-xs">{a.responsibleUser?.name ?? '—'}</td>
                  <td className="p-3 text-center text-xs font-medium">{a.status}</td>
                  <td className="p-3 text-center">
                    <span className={cn('inline-flex items-center rounded-md px-2 py-1 text-[10px] font-semibold border', STATUS_PILL[a.effectivenessStatus] ?? STATUS_PILL.NOT_STARTED)}>
                      {EFFECTIVENESS_LABEL[a.effectivenessStatus] ?? a.effectivenessStatus}
                    </span>
                  </td>
                  <td className="p-3 text-center text-xs">{formatDate(a.completedAt)}</td>
                  <td className="p-3 text-center">
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => openDialog(a)}>
                      <ShieldCheck className="h-3 w-3 mr-1" /> Analisar
                    </Button>
                  </td>
                </tr>
              ))}
              {actions.length === 0 && !query.isLoading && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                    Nenhuma acao no filtro selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog({ open, row: open ? dialog.row : null })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Analisar eficacia
            </DialogTitle>
          </DialogHeader>
          {dialog.row && (
            <div className="grid gap-4 text-sm">
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="font-semibold">{dialog.row.title}</div>
                {dialog.row.expectedResult && (
                  <div className="mt-2 text-xs">
                    <div className="font-semibold text-muted-foreground uppercase text-[10px]">Resultado esperado</div>
                    <div>{dialog.row.expectedResult}</div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className={cn(
                    'rounded-lg border p-3 text-left transition',
                    form.effective && !form.reopen && 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-300',
                  )}
                  onClick={() => setForm({ ...form, effective: true, reopen: false })}
                >
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 mb-1" />
                  <div className="font-semibold">Eficaz</div>
                  <div className="text-xs text-muted-foreground">Resultado atingido</div>
                </button>
                <button
                  type="button"
                  className={cn(
                    'rounded-lg border p-3 text-left transition',
                    !form.effective && !form.reopen && 'border-rose-500 bg-rose-50 ring-2 ring-rose-300',
                  )}
                  onClick={() => setForm({ ...form, effective: false, reopen: false })}
                >
                  <XCircle className="h-5 w-5 text-rose-600 mb-1" />
                  <div className="font-semibold">Ineficaz</div>
                  <div className="text-xs text-muted-foreground">Resultado nao atingido</div>
                </button>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.reopen}
                  onChange={(e) => setForm({ ...form, reopen: e.target.checked })}
                  className="h-4 w-4 rounded"
                />
                <RotateCcw className="h-3.5 w-3.5" /> Reabrir acao (precisa de nova execucao)
              </label>
              <div className="space-y-2">
                <Label>Resultado alcancado</Label>
                <Textarea rows={2} value={form.achievedResult} onChange={(e) => setForm({ ...form, achievedResult: e.target.value })} placeholder="Numero/indicador/situacao apos a acao" />
              </div>
              <div className="space-y-2">
                <Label>Resumo da analise</Label>
                <Textarea rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Conclusao sobre a eficacia" />
              </div>
              <div className="space-y-2">
                <Label>Evidencias (URLs, refs, anexos)</Label>
                <Input value={form.evidence} onChange={(e) => setForm({ ...form, evidence: e.target.value })} placeholder="Links, codigos de documentos, etc." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog({ open: false, row: null })}>Cancelar</Button>
            <Button onClick={submit} disabled={validate.isPending}>
              {form.reopen ? (
                <><RotateCcw className="mr-2 h-4 w-4" /> Reabrir</>
              ) : form.effective ? (
                <><CheckCircle2 className="mr-2 h-4 w-4" /> Validar como Eficaz</>
              ) : (
                <><AlertTriangle className="mr-2 h-4 w-4" /> Marcar como Ineficaz</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
