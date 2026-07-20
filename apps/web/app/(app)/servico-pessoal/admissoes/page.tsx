'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  HeartPulse,
  Plus,
  Stethoscope,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { ReasonDialog, type ReasonDialogState } from '@/components/platform/reason-dialog';

interface ProcessRow {
  id: string;
  kind: 'ONBOARDING' | 'OFFBOARDING';
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
  employee: { id: string; name: string; registrationId: string | null; status: string };
  totalItems: number;
  doneItems: number;
  pendingRequired: number;
}

interface ProcessDetail extends Omit<ProcessRow, 'totalItems' | 'doneItems' | 'pendingRequired'> {
  notes: string | null;
  items: Array<{
    id: string;
    title: string;
    required: boolean;
    dossierKind: string | null;
    doneAt: string | null;
    note: string | null;
    dossierSatisfied: boolean | null;
  }>;
}

interface ExamRow {
  id: string;
  type: string;
  examDate: string;
  validUntil: string | null;
  result: string;
  physician: string | null;
  status: 'VALID' | 'EXPIRING' | 'EXPIRED' | 'NO_EXPIRY';
  employee: { id: string; name: string; status: string };
}

const PROCESS_STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
};
const PROCESS_STATUS_CLASS: Record<string, string> = {
  IN_PROGRESS: 'border-status-yellow/40 text-status-yellow',
  COMPLETED: 'border-status-green/40 text-status-green',
  CANCELLED: 'border-border text-muted-foreground',
};
const EXAM_TYPE_LABEL: Record<string, string> = {
  ADMISSIONAL: 'Admissional',
  PERIODICO: 'Periódico',
  RETORNO_TRABALHO: 'Retorno ao trabalho',
  MUDANCA_RISCO: 'Mudança de risco',
  DEMISSIONAL: 'Demissional',
};
const EXAM_RESULT_LABEL: Record<string, string> = {
  APTO: 'Apto',
  APTO_COM_RESTRICAO: 'Apto c/ restrição',
  INAPTO: 'Inapto',
};
const EXAM_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  VALID: { label: 'Válido', className: 'border-status-green/40 text-status-green' },
  EXPIRING: { label: 'Vencendo', className: 'border-status-yellow/40 text-status-yellow' },
  EXPIRED: { label: 'Vencido', className: 'border-status-red/40 text-status-red' },
  NO_EXPIRY: { label: 'Sem validade', className: 'border-border text-muted-foreground' },
};

export default function LifecyclePage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission(['pessoal:update', 'pessoal:manage']);

  const [tab, setTab] = useState(searchParams.get('tab') ?? 'admissoes');
  const [reasonDialog, setReasonDialog] = useState<ReasonDialogState | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [startDialog, setStartDialog] = useState<'ONBOARDING' | 'OFFBOARDING' | null>(null);
  const [startForm, setStartForm] = useState({ employeeId: '', dueDate: '', notes: '' });
  const [examDialog, setExamDialog] = useState(false);
  const [examForm, setExamForm] = useState({ employeeId: '', type: 'PERIODICO', examDate: '', validUntil: '', result: 'APTO', physician: '', notes: '' });

  const processesQuery = useQuery<ProcessRow[]>({
    queryKey: ['personnel-processes'],
    queryFn: () => api<ProcessRow[]>('/personnel/processes'),
  });
  const detailQuery = useQuery<ProcessDetail>({
    queryKey: ['personnel-processes', detailId],
    queryFn: () => api<ProcessDetail>(`/personnel/processes/${detailId}`),
    enabled: Boolean(detailId),
  });
  const examsQuery = useQuery<{ items: ExamRow[]; kpis: { total: number; expiring: number; expired: number } }>({
    queryKey: ['personnel-exams'],
    queryFn: () => api('/personnel/medical-exams'),
    enabled: tab === 'aso',
  });
  const employeesQuery = useQuery<{ items: Array<{ id: string; name: string; status: string }> }>({
    queryKey: ['personnel-employees', 'ativos-lifecycle'],
    queryFn: () => api('/personnel/employees?status=ACTIVE'),
    enabled: Boolean(startDialog) || examDialog,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['personnel-processes'] });
    void qc.invalidateQueries({ queryKey: ['personnel-exams'] });
    void qc.invalidateQueries({ queryKey: ['personnel-employees'] });
    void qc.invalidateQueries({ queryKey: ['my-day'] });
  };

  const startProcess = useMutation({
    mutationFn: () =>
      api<ProcessDetail>('/personnel/processes', {
        method: 'POST',
        json: { kind: startDialog, employeeId: startForm.employeeId, dueDate: startForm.dueDate || undefined, notes: startForm.notes || undefined },
      }),
    onSuccess: (process) => {
      toast.success(startDialog === 'ONBOARDING' ? 'Admissão iniciada com checklist padrão' : 'Desligamento iniciado com checklist padrão');
      setStartDialog(null);
      setStartForm({ employeeId: '', dueDate: '', notes: '' });
      setDetailId(process.id);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível iniciar o processo'),
  });

  const toggleItem = useMutation({
    mutationFn: ({ itemId }: { itemId: string }) =>
      api(`/personnel/processes/${detailId}/items/${itemId}/toggle`, { method: 'POST', json: {} }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível atualizar o item'),
  });

  const completeProcess = useMutation({
    mutationFn: () => api(`/personnel/processes/${detailId}/complete`, { method: 'POST', json: {} }),
    onSuccess: () => {
      toast.success('Processo concluído');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível concluir (verifique os itens obrigatórios)'),
  });

  const cancelProcess = useMutation({
    mutationFn: (note: string) => api(`/personnel/processes/${detailId}/cancel`, { method: 'POST', json: { note } }),
    onSuccess: () => {
      toast.success('Processo cancelado');
      setDetailId(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível cancelar'),
  });

  const createExam = useMutation({
    mutationFn: () =>
      api('/personnel/medical-exams', {
        method: 'POST',
        json: {
          employeeId: examForm.employeeId,
          type: examForm.type,
          examDate: examForm.examDate,
          validUntil: examForm.validUntil || undefined,
          result: examForm.result,
          physician: examForm.physician || undefined,
          notes: examForm.notes || undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Exame registrado');
      setExamDialog(false);
      setExamForm({ employeeId: '', type: 'PERIODICO', examDate: '', validUntil: '', result: 'APTO', physician: '', notes: '' });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível registrar o exame'),
  });

  const detail = detailQuery.data ?? null;
  const onboarding = (processesQuery.data ?? []).filter((p) => p.kind === 'ONBOARDING');
  const offboarding = (processesQuery.data ?? []).filter((p) => p.kind === 'OFFBOARDING');

  const renderProcessList = (rows: ProcessRow[], kind: 'ONBOARDING' | 'OFFBOARDING') => (
    <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
          {kind === 'ONBOARDING' ? <UserPlus className="h-4 w-4 text-sky-500" /> : <UserMinus className="h-4 w-4 text-rose-500" />}
          {kind === 'ONBOARDING' ? 'Processos de admissão' : 'Processos de desligamento'}
        </h3>
        {canUpdate && (
          <Button size="sm" className="h-8 bg-sky-500 text-xs font-semibold text-white hover:bg-sky-600" onClick={() => { setStartForm({ employeeId: '', dueDate: '', notes: '' }); setStartDialog(kind); }}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />{kind === 'ONBOARDING' ? 'Iniciar admissão' : 'Iniciar desligamento'}
          </Button>
        )}
      </div>
      <CardContent className="space-y-2 p-4 text-xs">
        {rows.length === 0 && <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground">Nenhum processo registrado.</div>}
        {rows.map((process) => (
          <button
            key={process.id}
            type="button"
            onClick={() => setDetailId(process.id)}
            className="flex w-full flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-left transition-colors hover:bg-sky-50/40 dark:hover:bg-slate-900/50"
          >
            <div className="min-w-0">
              <div className="font-semibold text-slate-800 dark:text-slate-200">{process.employee.name}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                Iniciado em {formatDate(process.createdAt)}
                {process.dueDate && ` · prazo ${formatDate(process.dueDate)}`}
                {process.completedAt && ` · concluído em ${formatDate(process.completedAt)}`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {process.status === 'IN_PROGRESS' && (
                <span className="text-[10px] tabular-nums text-muted-foreground">{process.doneItems}/{process.totalItems} itens</span>
              )}
              <Badge variant="outline" className={cn('text-[10px]', PROCESS_STATUS_CLASS[process.status])}>{PROCESS_STATUS_LABEL[process.status]}</Badge>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admissão, Desligamento e ASO"
        description="Checklists digitais de admissão e desligamento integrados ao dossiê, e saúde ocupacional com alertas de vencimento (NR-7)."
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="bg-slate-100 dark:bg-slate-800">
          <TabsTrigger value="admissoes" className="text-xs font-semibold"><UserPlus className="mr-2 h-4 w-4" />Admissões</TabsTrigger>
          <TabsTrigger value="desligamentos" className="text-xs font-semibold"><UserMinus className="mr-2 h-4 w-4" />Desligamentos</TabsTrigger>
          <TabsTrigger value="aso" className="text-xs font-semibold">
            <Stethoscope className="mr-2 h-4 w-4" />Saúde Ocupacional
            {(examsQuery.data?.kpis?.expired ?? 0) > 0 && (
              <span className="ml-1.5 rounded-full bg-status-red/20 px-1.5 text-[10px] font-bold text-status-red">{examsQuery.data?.kpis.expired}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="admissoes">
          <div className="mb-3 rounded-md border border-sky-500/25 bg-sky-500/5 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fluxo da contratação</div>
            <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs">
              {[
                'Admissão (requisição/candidato)',
                'ASO admissional',
                'Verificação de documentos',
                'Conclusão da admissão',
                'Cadastro do colaborador',
              ].map((step, i, arr) => (
                <li key={step} className="flex items-center gap-1">
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-sky-500 text-[9px] font-bold text-white">{i + 1}</span>
                  <span className="text-muted-foreground">{step}</span>
                  {i < arr.length - 1 && <span className="mx-0.5 text-muted-foreground/50">→</span>}
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[11px] text-muted-foreground">
              O caminho automatizado começa no <Link href="/recrutamento" className="font-medium text-sky-600 hover:underline dark:text-sky-400">Recrutamento</Link> (candidato → proposta → ASO → documentos → autorizar admissão),
              que cria o colaborador na base única. Depois, no <Link href="/servico-pessoal/colaboradores" className="font-medium text-sky-600 hover:underline dark:text-sky-400">cadastro</Link>, complete os dados dos documentos: a matrícula é gerada automaticamente,
              e você define área, superior imediato (vem da árvore), escala e o usuário do portal. Os checklists abaixo acompanham o onboarding após a admissão.
            </p>
          </div>
          {renderProcessList(onboarding, 'ONBOARDING')}
        </TabsContent>
        <TabsContent value="desligamentos">{renderProcessList(offboarding, 'OFFBOARDING')}</TabsContent>

        <TabsContent value="aso">
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-xs text-muted-foreground">
            <Stethoscope className="h-3.5 w-3.5 shrink-0 text-sky-500" />
            <span>
              Esta aba registra exames de <strong>quem já é colaborador</strong> (periódico, retorno, mudança de risco, demissional).
              O ASO <strong>admissional de candidatos</strong> é conduzido na pré-admissão do Recrutamento, com acesso clínico segregado.
            </span>
            <Link href="/recrutamento/vagas" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
              Ir para o Recrutamento →
            </Link>
          </div>
          <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
                <HeartPulse className="h-4 w-4 text-sky-500" />Exames ocupacionais (ASO)
                <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                  {examsQuery.data?.kpis.expiring ?? 0} vencendo · {examsQuery.data?.kpis.expired ?? 0} vencido(s)
                </span>
              </h3>
              {canUpdate && (
                <Button size="sm" className="h-8 bg-sky-500 text-xs font-semibold text-white hover:bg-sky-600" onClick={() => setExamDialog(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />Registrar exame
                </Button>
              )}
            </div>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[760px] text-xs">
                <thead className="border-b bg-slate-50/60 text-[10px] uppercase tracking-wider text-muted-foreground dark:bg-slate-900/40">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Colaborador</th>
                    <th className="px-2 py-2.5 text-left">Tipo</th>
                    <th className="px-2 py-2.5 text-left">Data</th>
                    <th className="px-2 py-2.5 text-left">Validade</th>
                    <th className="px-2 py-2.5 text-left">Resultado</th>
                    <th className="px-2 py-2.5 text-left">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {(examsQuery.data?.items ?? []).map((exam) => (
                    <tr key={exam.id}>
                      <td className="max-w-[220px] truncate px-4 py-2 font-medium text-slate-800 dark:text-slate-200">{exam.employee.name}</td>
                      <td className="px-2 py-2">{EXAM_TYPE_LABEL[exam.type] ?? exam.type}</td>
                      <td className="px-2 py-2 tabular-nums">{formatDate(exam.examDate)}</td>
                      <td className="px-2 py-2 tabular-nums">{exam.validUntil ? formatDate(exam.validUntil) : '—'}</td>
                      <td className="px-2 py-2">{EXAM_RESULT_LABEL[exam.result] ?? exam.result}</td>
                      <td className="px-2 py-2">
                        <Badge variant="outline" className={cn('text-[10px]', EXAM_STATUS_BADGE[exam.status]?.className)}>
                          {EXAM_STATUS_BADGE[exam.status]?.label ?? exam.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(examsQuery.data?.items ?? []).length === 0 && (
                <div className="p-8 text-center text-xs text-muted-foreground">Nenhum exame registrado ainda.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: iniciar processo */}
      <Dialog open={Boolean(startDialog)} onOpenChange={(v) => !v && setStartDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{startDialog === 'ONBOARDING' ? 'Iniciar admissão digital' : 'Iniciar desligamento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              O processo é criado com o checklist padrão ({startDialog === 'ONBOARDING' ? 'documentos, contrato, ASO admissional, escala' : 'aviso, devoluções, demissional, acessos, rescisão'}).
              Itens vinculados a documentos indicam automaticamente quando o arquivo já está no dossiê.
            </div>
            <div>
              <Label>Colaborador</Label>
              <NativeSelect value={startForm.employeeId} onChange={(e) => setStartForm((f) => ({ ...f, employeeId: e.target.value }))}>
                <option value="">Selecione o colaborador</option>
                {(employeesQuery.data?.items ?? []).map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Prazo (opcional)</Label>
              <Input type="date" value={startForm.dueDate} onChange={(e) => setStartForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={2} value={startForm.notes} onChange={(e) => setStartForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartDialog(null)}>Cancelar</Button>
            <Button className="bg-sky-500 font-semibold text-white hover:bg-sky-600" disabled={!startForm.employeeId || startProcess.isPending} onClick={() => startProcess.mutate()}>
              {startProcess.isPending ? 'Iniciando...' : 'Iniciar processo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: detalhe do processo (checklist) */}
      <Dialog open={Boolean(detailId)} onOpenChange={(v) => !v && setDetailId(null)}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[92vh]">
          <DialogHeader>
            <DialogTitle>
              {detail ? (
                <span className="flex flex-wrap items-center gap-2">
                  {detail.kind === 'ONBOARDING' ? 'Admissão' : 'Desligamento'} — {detail.employee.name}
                  <Badge variant="outline" className={cn('text-[10px]', PROCESS_STATUS_CLASS[detail.status])}>{PROCESS_STATUS_LABEL[detail.status]}</Badge>
                </span>
              ) : 'Processo'}
            </DialogTitle>
          </DialogHeader>
          {!detail && <div className="p-6 text-sm text-muted-foreground">Carregando processo...</div>}
          {detail && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                {detail.items.map((item) => (
                  <div key={item.id} className={cn('flex items-center gap-3 rounded-md border p-2.5 text-xs', item.doneAt && 'bg-status-green/5')}>
                    <input
                      type="checkbox"
                      checked={Boolean(item.doneAt)}
                      disabled={!canUpdate || detail.status !== 'IN_PROGRESS' || toggleItem.isPending}
                      onChange={() => toggleItem.mutate({ itemId: item.id })}
                    />
                    <div className="min-w-0 flex-1">
                      <span className={cn('font-medium', item.doneAt && 'text-muted-foreground line-through')}>{item.title}</span>
                      {!item.required && <span className="ml-1 text-[9px] text-muted-foreground">(opcional)</span>}
                    </div>
                    {item.dossierSatisfied === true && (
                      <Badge variant="outline" className="shrink-0 border-status-green/40 text-[9px] text-status-green">
                        <FileCheck2 className="mr-1 h-3 w-3" />no dossiê
                      </Badge>
                    )}
                    {item.dossierSatisfied === false && (
                      <Badge variant="outline" className="shrink-0 border-status-yellow/40 text-[9px] text-status-yellow">falta no dossiê</Badge>
                    )}
                  </div>
                ))}
              </div>
              {detail.notes && <div className="rounded-md border p-3 text-xs text-muted-foreground">{detail.notes}</div>}
              {canUpdate && detail.status === 'IN_PROGRESS' && (
                <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                  <Button variant="outline" size="sm" className="text-xs" disabled={cancelProcess.isPending} onClick={() => setReasonDialog({
                    title: 'Cancelar processo',
                    label: 'Justificativa do cancelamento',
                    confirmLabel: 'Cancelar processo',
                    destructive: true,
                    onConfirm: (note) => cancelProcess.mutate(note),
                  })}>
                    <X className="mr-1.5 h-3.5 w-3.5" />Cancelar processo
                  </Button>
                  <Button size="sm" className="bg-status-green text-xs font-semibold text-white hover:bg-status-green/90" disabled={completeProcess.isPending} onClick={() => completeProcess.mutate()}>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    {detail.kind === 'OFFBOARDING' ? 'Concluir e desligar colaborador' : 'Concluir admissão'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: registrar exame */}
      <Dialog open={examDialog} onOpenChange={setExamDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar exame ocupacional (ASO)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Colaborador</Label>
              <NativeSelect value={examForm.employeeId} onChange={(e) => setExamForm((f) => ({ ...f, employeeId: e.target.value }))}>
                <option value="">Selecione o colaborador</option>
                {(employeesQuery.data?.items ?? []).map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
              </NativeSelect>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <NativeSelect value={examForm.type} onChange={(e) => setExamForm((f) => ({ ...f, type: e.target.value }))}>
                  {Object.entries(EXAM_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </div>
              <div>
                <Label>Resultado</Label>
                <NativeSelect value={examForm.result} onChange={(e) => setExamForm((f) => ({ ...f, result: e.target.value }))}>
                  {Object.entries(EXAM_RESULT_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </div>
              <div>
                <Label>Data do exame</Label>
                <Input type="date" value={examForm.examDate} onChange={(e) => setExamForm((f) => ({ ...f, examDate: e.target.value }))} />
              </div>
              <div>
                <Label>Validade (vazio = 12 meses)</Label>
                <Input type="date" value={examForm.validUntil} onChange={(e) => setExamForm((f) => ({ ...f, validUntil: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Médico responsável</Label>
              <Input value={examForm.physician} onChange={(e) => setExamForm((f) => ({ ...f, physician: e.target.value }))} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={2} value={examForm.notes} onChange={(e) => setExamForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExamDialog(false)}>Cancelar</Button>
            <Button className="bg-sky-500 font-semibold text-white hover:bg-sky-600" disabled={createExam.isPending || !examForm.employeeId || !examForm.examDate} onClick={() => createExam.mutate()}>
              {createExam.isPending ? 'Registrando...' : 'Registrar exame'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReasonDialog state={reasonDialog} onClose={() => setReasonDialog(null)} />
    </div>
  );
}
