'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle,
  ChevronRight,
  Clock,
  Coins,
  Download,
  Eye,
  FileBarChart,
  FileCheck,
  FileDown,
  FileHeart,
  Import,
  Info,
  Lock,
  Play,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Settings,
  Unlock,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/auth-provider';
import PayslipCard, { formatCurrency, formatCompetence } from '@/components/payroll/payslip-card';

interface WorkerRow {
  id: string;
  employeeId: string;
  status: string;
  baseSalary: string;
  totalEarnings: string;
  totalDeductions: string;
  netPay: string;
  inssBase: string;
  inssValue: string;
  irrfBase: string;
  irrfValue: string;
  fgtsBase: string;
  fgtsValue: string;
  issues: string[] | null;
  items: any[];
  employee: {
    name: string;
    registrationId: string | null;
    job?: { name: string } | null;
  } | null;
}

interface RunDetail {
  id: string;
  competenceId: string;
  kind: 'MENSAL' | 'ADIANTAMENTO';
  status: string;
  version: number;
  totals: {
    workers: number;
    withIssues: number;
    gross: string;
    deductions: string;
    net: string;
  } | null;
  issues: string[] | null;
  calculatedAt: string | null;
  calculatedById: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  closedById: string | null;
  closedAt: string | null;
  reopenNote: string | null;
  createdAt: string;
  snapshotCount: number;
  workers: WorkerRow[];
  competence?: {
    id: string;
    year: number;
    month: number;
    status: 'OPEN' | 'CLOSED';
  } | null;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  IMPORTING: 'Importando',
  CALCULATING: 'Calculando',
  CALCULATED: 'Calculado',
  WITH_ISSUES: 'Inconsistências',
  APPROVED: 'Aprovado',
  CLOSED: 'Fechado',
  REOPENED: 'Reaberto',
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground border-transparent',
  IMPORTING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-transparent',
  CALCULATING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-transparent',
  CALCULATED: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400 border-transparent',
  WITH_ISSUES: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-transparent',
  APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-transparent',
  CLOSED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-transparent',
  REOPENED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-transparent',
};

export default function RunDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const router = useRouter();
  const { user, hasPermission } = useAuth();

  const [search, setSearch] = useState('');
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenNote, setReopenNote] = useState('');
  const [printBatchOpen, setPrintBatchOpen] = useState(false);

  const runQuery = useQuery<RunDetail>({
    queryKey: ['payroll-run', id],
    queryFn: () => api<RunDetail>(`/payroll/runs/${id}`),
    enabled: !!id,
  });

  const importTimekeeping = useMutation({
    mutationFn: () => api<{ imported: number }>(`/payroll/runs/${id}/import-timekeeping`, { method: 'POST' }),
    onSuccess: (data) => {
      toast.success(`Importado com sucesso. ${data.imported} colaborador(es) congelados.`);
      void qc.invalidateQueries({ queryKey: ['payroll-run', id] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao importar ponto.'),
  });

  const calculateRun = useMutation({
    mutationFn: () => api<RunDetail>(`/payroll/runs/${id}/calculate`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Cálculo da folha finalizado com sucesso.');
      void qc.invalidateQueries({ queryKey: ['payroll-run', id] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao processar cálculos.'),
  });

  const approveRun = useMutation({
    mutationFn: () => api<RunDetail>(`/payroll/runs/${id}/approve`, { method: 'POST' }),
    onSuccess: (data) => {
      if (data.calculatedById === user?.id) {
        toast.warning('Folha aprovada! Alerta: Lote aprovado pelo mesmo analista que calculou.');
      } else {
        toast.success('Lote de folha aprovado com sucesso.');
      }
      void qc.invalidateQueries({ queryKey: ['payroll-run', id] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao aprovar.'),
  });

  const closeRun = useMutation({
    mutationFn: () => api<RunDetail>(`/payroll/runs/${id}/close`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Competência/Lote fechado com sucesso.');
      void qc.invalidateQueries({ queryKey: ['payroll-run', id] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao fechar.'),
  });

  const reopenRun = useMutation({
    mutationFn: (json: { note: string }) => api<RunDetail>(`/payroll/runs/${id}/reopen`, { method: 'POST', json }),
    onSuccess: () => {
      toast.success('Folha reaberta com sucesso. Trilha de auditoria atualizada.');
      setReopenOpen(false);
      setReopenNote('');
      void qc.invalidateQueries({ queryKey: ['payroll-run', id] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao reabrir.'),
  });

  if (runQuery.isLoading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Carregando lote de folha...</div>;
  }

  if (runQuery.isError || !runQuery.data) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Processamento de folha não encontrado.</div>;
  }

  const r = runQuery.data;
  const canOperate = hasPermission(['folha:operate']);
  const canApprove = hasPermission(['folha:approve']);
  const canClose = hasPermission(['folha:close']);

  const editable = ['DRAFT', 'CALCULATED', 'WITH_ISSUES', 'REOPENED'].includes(r.status);
  const isCalculated = ['CALCULATED', 'APPROVED', 'CLOSED'].includes(r.status);

  async function downloadAccounting() {
    try {
      const res = await api<{ csv: string; balanced: boolean; fileName: string }>(`/payroll/runs/${id}/accounting`);
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = res.fileName; a.click();
      URL.revokeObjectURL(url);
      toast.success(res.balanced ? 'Contabilização gerada (balanceada).' : 'Contabilização gerada — DIVERGENTE, confira.');
    } catch (e: any) { toast.error(e.message || 'Erro ao gerar contabilização.'); }
  }

  const filteredWorkers = r.workers.filter((w) =>
    (w.employee?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (w.employee?.registrationId ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const handlePrintAll = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const payslipsHtml = r.workers
      .map((w) => {
        const proventos = w.items.filter((i) => i.nature === 'PROVENTO');
        const descontos = w.items.filter((i) => i.nature === 'DESCONTO');
        const informativas = w.items.filter((i) => i.nature === 'INFORMATIVA');

        const tableRows: any[] = [];
        const maxRows = Math.max(proventos.length, descontos.length, informativas.length);

        for (let i = 0; i < maxRows; i++) {
          const prov = proventos[i];
          const desc = descontos[i];
          const inf = informativas[i];
          tableRows.push({
            code: prov?.rubricCode || desc?.rubricCode || inf?.rubricCode || '',
            name: prov?.rubricName || desc?.rubricName || inf?.rubricName || '',
            ref: prov?.reference || desc?.reference || inf?.reference || '',
            provento: prov ? formatCurrency(prov.amount) : '',
            desconto: desc ? formatCurrency(desc.amount) : inf ? `(${formatCurrency(inf.amount)})*` : '',
          });
        }

        while (tableRows.length < 6) {
          tableRows.push({ code: '', name: '', ref: '', provento: '', desconto: '' });
        }

        return `
          <div class="page-break border-print mb-8 p-4 bg-white rounded-md shadow-sm border border-black max-w-[800px] mx-auto font-mono text-[11px]">
            <!-- Header -->
            <div class="grid grid-cols-4 border-b border-black pb-2">
              <div class="col-span-3">
                <div class="font-bold text-[12px] uppercase">GESTÃO 360 CORP</div>
                <div>CNPJ: 00.000.000/0001-00</div>
                <div class="text-[10px] text-gray-500 mt-1">RECIBO DE PAGAMENTO DE SALÁRIO</div>
              </div>
              <div class="text-center bg-gray-100 p-2 flex flex-col justify-center border-l border-black">
                <div class="text-[9px] uppercase text-gray-500 font-semibold">Competência</div>
                <div class="text-[14px] font-bold">${r.competence ? formatCompetence(r.competence.year, r.competence.month) : ''}</div>
                <div class="text-[9px] uppercase text-gray-500 font-semibold mt-1">${r.kind}</div>
              </div>
            </div>
            <!-- Employee -->
            <div class="grid grid-cols-6 border-b border-black py-1.5 bg-gray-50">
              <div class="col-span-1 px-2 border-r border-black">
                <span class="block text-[8px] text-gray-500">REGISTRO</span>
                <span class="font-bold">${w.employee?.registrationId || '—'}</span>
              </div>
              <div class="col-span-3 px-2 border-r border-black">
                <span class="block text-[8px] text-gray-500">COLABORADOR</span>
                <span class="font-bold text-[11px] uppercase">${w.employee?.name || '—'}</span>
              </div>
              <div class="col-span-2 px-2">
                <span class="block text-[8px] text-gray-500">CARGO</span>
                <span class="font-bold truncate block">${w.employee?.job?.name || '—'}</span>
              </div>
            </div>
            <!-- Body -->
            <div class="grid grid-cols-12 border-b border-black font-bold bg-gray-100 py-1 text-[9px] px-2 uppercase">
              <div class="col-span-1 text-center">Cód.</div>
              <div class="col-span-5">Descrição</div>
              <div class="col-span-2 text-right">Referência</div>
              <div class="col-span-2 text-right">Proventos</div>
              <div class="col-span-2 text-right">Descontos</div>
            </div>
            <div class="min-h-[160px] divide-y divide-gray-100">
              ${tableRows
                .map(
                  (row) => `
                <div class="grid grid-cols-12 px-2 py-0.5">
                  <div class="col-span-1 text-center text-gray-500">${row.code}</div>
                  <div class="col-span-5 truncate uppercase">${row.name}</div>
                  <div class="col-span-2 text-right">${row.ref}</div>
                  <div class="col-span-2 text-right text-emerald-600 font-semibold">${row.provento}</div>
                  <div class="col-span-2 text-right text-red-600 font-semibold">${row.desconto}</div>
                </div>
              `
                )
                .join('')}
            </div>
            <!-- Totals -->
            <div class="border-t border-black bg-gray-50">
              <div class="grid grid-cols-12 px-2 py-1 font-bold border-b border-black text-[10px]">
                <div class="col-span-8 text-right">Totais</div>
                <div class="col-span-2 text-right text-emerald-600">${formatCurrency(w.totalEarnings)}</div>
                <div class="col-span-2 text-right text-red-600">${formatCurrency(w.totalDeductions)}</div>
              </div>
              <div class="grid grid-cols-12 px-2 py-1.5 font-bold text-[12px] bg-gray-100 items-center">
                <div class="col-span-8 text-right text-[10px] text-gray-500 uppercase">Valor Líquido a Receber</div>
                <div class="col-span-4 text-right text-blue-600 font-extrabold pr-1">R$ ${formatCurrency(w.netPay)}</div>
              </div>
            </div>
            <!-- Bases -->
            <div class="grid grid-cols-5 border-t border-black text-[9px] uppercase bg-gray-50">
              <div class="p-1 border-r border-black text-center">
                <span class="block text-gray-500 text-[8px]">Base INSS</span>
                <span>${formatCurrency(w.inssBase)}</span>
              </div>
              <div class="p-1 border-r border-black text-center">
                <span class="block text-gray-500 text-[8px]">Val. INSS</span>
                <span>${formatCurrency(w.inssValue)}</span>
              </div>
              <div class="p-1 border-r border-black text-center">
                <span class="block text-gray-500 text-[8px]">Base FGTS</span>
                <span>${formatCurrency(w.fgtsBase)}</span>
              </div>
              <div class="p-1 border-r border-black text-center">
                <span class="block text-gray-500 text-[8px]">FGTS Mês</span>
                <span>${formatCurrency(w.fgtsValue)}</span>
              </div>
              <div class="p-1 text-center">
                <span class="block text-gray-500 text-[8px]">Val. IRRF</span>
                <span>${formatCurrency(w.irrfValue)}</span>
              </div>
            </div>
            <!-- Footer Signature -->
            <div class="grid grid-cols-2 border-t border-black pt-4 pb-2 px-4 text-[10px]">
              <div>
                <div class="w-[180px] border-b border-black h-[25px]"></div>
                <div class="mt-1 text-gray-400 text-[9px] uppercase">Assinatura do Empregado</div>
              </div>
              <div class="text-right text-[8px] text-gray-400 flex flex-col justify-end">
                <div>Hash de Autenticação: ${w.id.slice(0, 8).toUpperCase()}-${w.id.slice(-8).toUpperCase()}</div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Holerites em Lote - ${r.kind}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body { padding: 1cm; background: white; }
              .page-break { page-break-after: always; break-after: page; border: 1px solid #000 !important; margin-bottom: 0 !important; }
              .no-print { display: none; }
            }
            body { background: #f3f4f6; }
            .border-print { border: 1px solid #000; }
          </style>
        </head>
        <body onload="window.print();window.close()">
          <div class="py-6">
            ${payslipsHtml}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/servico-pessoal/folha" className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar para o Painel
        </Link>
      </div>

      <PageHeader
        title={`Processamento ${r.kind}`}
        description={`Versão ${r.version} · Criado em ${new Date(r.createdAt).toLocaleDateString('pt-BR')}`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ['payroll-run', id] })}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            {isCalculated && (
              <Button onClick={handlePrintAll} size="sm" variant="outline" className="gap-1">
                <Printer className="h-4 w-4" /> Imprimir em Lote
              </Button>
            )}
            {isCalculated && (
              <Button onClick={downloadAccounting} size="sm" variant="outline" className="gap-1">
                <FileSpreadsheet className="h-4 w-4" /> Contabilização
              </Button>
            )}
          </div>
        }
      />

      {/* Operações & Passos (Checklist/Stepper) */}
      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Fluxo de Fechamento do Lote</CardTitle>
          <CardDescription>
            Siga as etapas sequencialmente para consolidar os cálculos da competência. O passo{' '}
            <strong>Calcular</strong> gera a PRÉVIA completa por colaborador (proventos, benefícios, descontos, INSS/IRRF
            e líquido) — nada é pago nem liberado no portal do colaborador até o passo <strong>Fechar</strong>; até lá é
            possível recalcular quantas vezes precisar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-5 text-xs">
            {/* Passo 1: Ponto */}
            <div className={cn('p-3 rounded-lg border flex flex-col justify-between gap-3', r.snapshotCount > 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-muted/10 border-border/80')}>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Badge variant={r.snapshotCount > 0 ? 'default' : 'secondary'} className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">1</Badge>
                  <span>Importar Ponto</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Congela a lista de colaboradores ativos e o espelho de ponto atual em um snapshot imutável.
                </p>
              </div>
              <div>
                {r.snapshotCount > 0 ? (
                  <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                    <CheckCircle className="h-3.5 w-3.5" /> {r.snapshotCount} congelado(s)
                  </div>
                ) : (
                  canOperate && editable && (
                    <Button onClick={() => importTimekeeping.mutate()} disabled={importTimekeeping.isPending} size="sm" className="w-full">
                      <Import className="mr-1 h-3.5 w-3.5" /> Importar
                    </Button>
                  )
                )}
              </div>
            </div>

            {/* Passo 2: Calcular */}
            <div className={cn('p-3 rounded-lg border flex flex-col justify-between gap-3', isCalculated ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-muted/10 border-border/80')}>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Badge variant={isCalculated ? 'default' : 'secondary'} className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">2</Badge>
                  <span>Calcular Lote</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Executa as rubricas, calcula INSS/IRRF/FGTS e gera a memória detalhada de cálculo.
                </p>
              </div>
              <div>
                {isCalculated ? (
                  <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                    <CheckCircle className="h-3.5 w-3.5" /> Calculado
                  </div>
                ) : (
                  canOperate && editable && r.snapshotCount > 0 && (
                    <Button onClick={() => calculateRun.mutate()} disabled={calculateRun.isPending} size="sm" className="w-full">
                      <Play className="mr-1 h-3.5 w-3.5" /> Calcular
                    </Button>
                  )
                )}
              </div>
            </div>

            {/* Passo 3: Inconsistências */}
            <div className={cn('p-3 rounded-lg border flex flex-col justify-between gap-3', r.status === 'WITH_ISSUES' ? 'bg-red-500/5 border-red-500/20' : 'bg-muted/10 border-border/80')}>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Badge variant={r.status === 'WITH_ISSUES' ? 'destructive' : 'secondary'} className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">3</Badge>
                  <span>Verificar Inconsistências</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Detecta impedimentos no cálculo (ex: colaboradores sem salário contratual cadastrado).
                </p>
              </div>
              <div>
                {r.totals && r.totals.withIssues > 0 ? (
                  <Badge variant="destructive" className="flex items-center gap-1 w-full justify-center text-[10px]">
                    <AlertTriangle className="h-3 w-3" /> {r.totals.withIssues} pendência(s)
                  </Badge>
                ) : (
                  <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                    <CheckCircle className="h-3.5 w-3.5" /> Regularizado
                  </div>
                )}
              </div>
            </div>

            {/* Passo 4: Aprovação */}
            <div className={cn('p-3 rounded-lg border flex flex-col justify-between gap-3', ['APPROVED', 'CLOSED'].includes(r.status) ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-muted/10 border-border/80')}>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Badge variant={['APPROVED', 'CLOSED'].includes(r.status) ? 'default' : 'secondary'} className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">4</Badge>
                  <span>Aprovar Lote</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Aprovação humana mandatória sobre o lote calculado. Não permite recálculos automáticos.
                </p>
              </div>
              <div>
                {['APPROVED', 'CLOSED'].includes(r.status) ? (
                  <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                    <CheckCircle className="h-3.5 w-3.5" /> Aprovado
                  </div>
                ) : (
                  canApprove && r.status === 'CALCULATED' && (
                    <Button onClick={() => approveRun.mutate()} disabled={approveRun.isPending} size="sm" className="w-full">
                      <FileCheck className="mr-1 h-3.5 w-3.5" /> Aprovar Lote
                    </Button>
                  )
                )}
              </div>
            </div>

            {/* Passo 5: Fechar Lote */}
            <div className={cn('p-3 rounded-lg border flex flex-col justify-between gap-3', r.status === 'CLOSED' ? 'bg-purple-500/5 border-purple-500/20' : 'bg-muted/10 border-border/80')}>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Badge variant={r.status === 'CLOSED' ? 'default' : 'secondary'} className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">5</Badge>
                  <span>Fechar Lote</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Fecha a folha, trava qualquer recálculo e publica os holerites no Portal do Colaborador.
                </p>
              </div>
              <div className="flex gap-1.5">
                {r.status === 'CLOSED' ? (
                  <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-bold w-full">
                    <Lock className="h-3.5 w-3.5" /> Fechado
                  </div>
                ) : (
                  canClose && r.status === 'APPROVED' && (
                    <Button onClick={() => closeRun.mutate()} disabled={closeRun.isPending} size="sm" className="w-full">
                      <Lock className="mr-1 h-3.5 w-3.5" /> Fechar Lote
                    </Button>
                  )
                )}

                {/* Reabrir se estiver aprovado ou fechado */}
                {canClose && ['APPROVED', 'CLOSED'].includes(r.status) && (
                  <Button onClick={() => setReopenOpen(true)} size="sm" variant="destructive" className="w-full">
                    Reabrir
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Justificativa de reabertura */}
          {r.reopenNote && (
            <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-md text-xs flex gap-2">
              <Info className="h-4 w-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold block mb-0.5">Motivo da Reabertura Recente:</span>
                <span className="text-muted-foreground italic">“{r.reopenNote}”</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Consolidados do Lote */}
      {r.totals && (
        <div className="grid gap-4 md:grid-cols-4 text-center">
          <Card className="border-border/60">
            <CardContent className="pt-4">
              <span className="text-xs text-muted-foreground uppercase font-bold block mb-1">Colaboradores</span>
              <span className="text-2xl font-extrabold flex items-center justify-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" /> {r.totals.workers}
              </span>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="pt-4">
              <span className="text-xs text-muted-foreground uppercase font-bold block mb-1">Total Proventos</span>
              <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-500">
                R$ {formatCurrency(r.totals.gross)}
              </span>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="pt-4">
              <span className="text-xs text-muted-foreground uppercase font-bold block mb-1">Total Descontos</span>
              <span className="text-2xl font-extrabold text-red-600 dark:text-red-400">
                R$ {formatCurrency(r.totals.deductions)}
              </span>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="pt-4">
              <span className="text-xs text-muted-foreground uppercase font-bold block mb-1">Total Líquido</span>
              <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                R$ {formatCurrency(r.totals.net)}
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lista de Colaboradores */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Colaboradores no Lote</CardTitle>
            <CardDescription>Resumo dos valores calculados por colaborador</CardDescription>
          </div>
          <div className="flex gap-2">
            <div className="relative w-52 no-print">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar colaborador..."
                className="pl-8 h-9 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-y border-border bg-muted/40 text-muted-foreground py-2 uppercase font-semibold text-[10px]">
                  <th className="p-3">Registro</th>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Salário Base</th>
                  <th className="p-3">Proventos</th>
                  <th className="p-3">Descontos</th>
                  <th className="p-3">Líquido</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredWorkers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      Nenhum colaborador encontrado no processamento.
                    </td>
                  </tr>
                )}
                {filteredWorkers.map((w) => (
                  <tr key={w.id} className="hover:bg-muted/10 items-center">
                    <td className="p-3 font-semibold text-muted-foreground">{w.employee?.registrationId || '—'}</td>
                    <td className="p-3 font-bold uppercase">{w.employee?.name || '—'}</td>
                    <td className="p-3">R$ {formatCurrency(w.baseSalary)}</td>
                    <td className="p-3 text-emerald-600 dark:text-emerald-500 font-semibold">
                      R$ {formatCurrency(w.totalEarnings)}
                    </td>
                    <td className="p-3 text-red-600 dark:text-red-400 font-semibold">
                      R$ {formatCurrency(w.totalDeductions)}
                    </td>
                    <td className="p-3 text-blue-600 dark:text-blue-400 font-bold">
                      R$ {formatCurrency(w.netPay)}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={w.status === 'WITH_ISSUES' ? 'destructive' : 'outline'}
                        className="text-[10px] py-0.5"
                      >
                        {w.status === 'WITH_ISSUES' ? 'Com erros' : 'Calculado'}
                      </Badge>
                      {w.issues && w.issues.length > 0 && (
                        <span className="block text-[10px] text-red-500 font-semibold mt-0.5">{w.issues[0]}</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <Link href={`/servico-pessoal/folha/workers/${w.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* DIALOG: Reabrir Lote */}
      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reabrir Processamento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 text-sm">
            <p className="text-muted-foreground leading-relaxed text-xs">
              A reabertura de uma folha aprovada ou fechada é um evento crítico e será gravado permanentemente na trilha de auditoria central. Forneça uma justificativa detalhada.
            </p>
            <div className="grid gap-2">
              <Label htmlFor="note">Justificativa da Reabertura</Label>
              <Input
                id="note"
                value={reopenNote}
                onChange={(e) => setReopenNote(e.target.value)}
                placeholder="Mínimo de 5 caracteres"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => reopenRun.mutate({ note: reopenNote })}
              disabled={reopenNote.trim().length < 5 || reopenRun.isPending}
            >
              {reopenRun.isPending ? 'Gravando...' : 'Gravar Reabertura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
