'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Banknote,
  Heart,
  Plus,
  ArrowLeft,
  Users,
  Settings,
  ShieldAlert,
  Percent,
  CheckCircle,
  Clock,
  Briefcase,
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

interface Employee {
  id: string;
  name: string;
  registrationId: string;
}

interface Benefit {
  id: string;
  name: string;
  provider: string;
  kind: string;
  type: string;
  value: string;
  copayRateBp: number;
}

interface Loan {
  id: string;
  employeeId: string;
  bankName: string;
  contractId: string;
  totalAmount: string;
  installmentAmount: string;
  totalInstallments: number;
  paidInstallments: number;
}

interface Pension {
  id: string;
  employeeId: string;
  dependentId: string;
  percentage: string;
  baseType: string;
  active: boolean;
}

export default function BenefitsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canOperate = hasPermission(['folha:operate']);
  const canParams = hasPermission(['folha:params']);

  const [activeTab, setActiveTab] = useState('benefits');

  // Dialogs
  const [benefitOpen, setBenefitOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);
  const [pensionOpen, setPensionOpen] = useState(false);

  // Forms
  const [benefitForm, setBenefitForm] = useState({
    name: '',
    provider: '',
    kind: 'VT',
    type: 'VALOR_FIXO',
    value: '0.00',
    copayRateBp: 0,
  });

  const [enrollForm, setEnrollForm] = useState({
    employeeId: '',
    benefitId: '',
    customValue: '',
  });

  const [loanForm, setLoanForm] = useState({
    employeeId: '',
    bankName: '',
    contractId: '',
    totalAmount: '0.00',
    installmentAmount: '0.00',
    totalInstallments: 12,
  });

  const [pensionForm, setPensionForm] = useState({
    employeeId: '',
    dependentId: 'dep-judicial',
    percentage: '15.00',
    baseType: 'NET',
  });

  // Queries
  const employeesQuery = useQuery<Employee[]>({
    queryKey: ['personnel-employees'],
    queryFn: () => api<Employee[]>('/personnel/employees'),
  });

  const benefitsQuery = useQuery<Benefit[]>({
    queryKey: ['payroll-benefits'],
    queryFn: () => api<Benefit[]>('/payroll/benefits'),
  });

  const loansQuery = useQuery<Loan[]>({
    queryKey: ['payroll-loans'],
    queryFn: () => api<Loan[]>('/payroll/loans'),
  });

  const pensionsQuery = useQuery<Pension[]>({
    queryKey: ['payroll-pensions'],
    queryFn: () => api<Pension[]>('/payroll/pensions'),
  });

  // Mutations
  const createBenefit = useMutation({
    mutationFn: (json: any) => api('/payroll/benefits', { method: 'POST', json }),
    onSuccess: () => {
      toast.success('Benefício criado com sucesso.');
      setBenefitOpen(false);
      void qc.invalidateQueries({ queryKey: ['payroll-benefits'] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao criar benefício.'),
  });

  const enrollBenefit = useMutation({
    mutationFn: (json: any) => api('/payroll/benefits/enroll', { method: 'POST', json }),
    onSuccess: () => {
      toast.success('Associação de benefício realizada.');
      setEnrollOpen(false);
      void qc.invalidateQueries({ queryKey: ['payroll-benefits'] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao associar benefício.'),
  });

  const createLoan = useMutation({
    mutationFn: (json: any) => api('/payroll/loans', { method: 'POST', json }),
    onSuccess: () => {
      toast.success('Empréstimo consignado registrado.');
      setLoanOpen(false);
      void qc.invalidateQueries({ queryKey: ['payroll-loans'] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao registrar empréstimo.'),
  });

  const createPension = useMutation({
    mutationFn: (json: any) => api('/payroll/pensions', { method: 'POST', json }),
    onSuccess: () => {
      toast.success('Pensão alimentícia vinculada.');
      setPensionOpen(false);
      void qc.invalidateQueries({ queryKey: ['payroll-pensions'] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao registrar pensão.'),
  });

  const employeeMap = new Map(employeesQuery.data?.map((e) => [e.id, e]));

  const formatCurrency = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleOpenEnroll = (benefitId: string) => {
    if (employeesQuery.data?.length === 0) {
      toast.error('Nenhum colaborador cadastrado.');
      return;
    }
    setEnrollForm({
      employeeId: employeesQuery.data?.[0]?.id ?? '',
      benefitId,
      customValue: '',
    });
    setEnrollOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/servico-pessoal/folha">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader
          title="Benefícios e Descontos Recorrentes"
          description="Controle e parametrização de benefícios (VT, VA, VR, Planos de Saúde), pensões alimentícias judiciais e parcelas de empréstimos consignados."
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full md:w-[450px] grid-cols-3">
          <TabsTrigger value="benefits">Benefícios</TabsTrigger>
          <TabsTrigger value="loans">Consignados</TabsTrigger>
          <TabsTrigger value="pensions">Pensões</TabsTrigger>
        </TabsList>

        {/* TAB 1: BENEFÍCIOS */}
        <TabsContent value="benefits" className="space-y-4">
          <Card className="border-border/80 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Catálogo de Benefícios</CardTitle>
                <CardDescription>Crie benefícios padrão da empresa e associe-os individualmente.</CardDescription>
              </div>
              {canParams && (
                <Button onClick={() => setBenefitOpen(true)}>
                  <Plus className="mr-1 h-4 w-4" /> Novo Benefício
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {benefitsQuery.isLoading ? (
                <div className="py-8 text-center text-muted-foreground">Carregando benefícios...</div>
              ) : (benefitsQuery.data?.length ?? 0) === 0 ? (
                <div className="py-8 text-center text-muted-foreground">Nenhum benefício cadastrado.</div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {benefitsQuery.data?.map((b) => (
                    <Card key={b.id} className="bg-gradient-to-br from-background to-muted/30 border shadow-sm">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <Badge variant="secondary" className="bg-sky-50 text-sky-800 dark:bg-sky-950/20 dark:text-sky-400 border-transparent uppercase font-bold text-[10px]">
                            {b.kind}
                          </Badge>
                          <span className="text-sm font-bold text-sky-600 dark:text-sky-400">
                            {formatCurrency(b.value)}
                          </span>
                        </div>
                        <CardTitle className="text-base font-bold mt-1.5">{b.name}</CardTitle>
                        <CardDescription className="text-xs">{b.provider}</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-2 pb-3">
                        <div className="text-xs text-muted-foreground mb-4">
                          Coparticipação máxima: {b.copayRateBp / 100}%
                        </div>
                        {canOperate && (
                          <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => handleOpenEnroll(b.id)}>
                            <Users className="mr-1 h-3.5 w-3.5" /> Associar Colaborador
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: CONSIGNADOS */}
        <TabsContent value="loans" className="space-y-4">
          <Card className="border-border/80 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Empréstimos Consignados em Folha</CardTitle>
                <CardDescription>Controle de parcelas fixas descontadas direto da folha salarial de acordo com a margem.</CardDescription>
              </div>
              {canOperate && (
                <Button onClick={() => {
                  if (employeesQuery.data?.length === 0) {
                    toast.error('Nenhum colaborador cadastrado.');
                    return;
                  }
                  setLoanForm({
                    employeeId: employeesQuery.data?.[0]?.id ?? '',
                    bankName: '',
                    contractId: '',
                    totalAmount: '0.00',
                    installmentAmount: '0.00',
                    totalInstallments: 12,
                  });
                  setLoanOpen(true);
                }}>
                  <Plus className="mr-1 h-4 w-4" /> Novo Consignado
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loansQuery.isLoading ? (
                <div className="py-8 text-center text-muted-foreground">Carregando empréstimos consignados...</div>
              ) : (loansQuery.data?.length ?? 0) === 0 ? (
                <div className="py-8 text-center text-muted-foreground">Nenhum consignado ativo registrado.</div>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b font-semibold">
                      <tr>
                        <th className="p-3">Funcionário</th>
                        <th className="p-3">Banco</th>
                        <th className="p-3">Contrato ID</th>
                        <th className="p-3 text-center">Parcela / Valor</th>
                        <th className="p-3 text-center">Progresso Parcelas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {loansQuery.data?.map((l) => {
                        const emp = employeeMap.get(l.employeeId);
                        return (
                          <tr key={l.id} className="hover:bg-muted/10">
                            <td className="p-3 font-medium">
                              {emp?.name ?? 'Colaborador'}
                            </td>
                            <td className="p-3 text-xs">{l.bankName}</td>
                            <td className="p-3 text-xs font-mono">{l.contractId}</td>
                            <td className="p-3 text-center font-bold text-rose-500">
                              {formatCurrency(l.installmentAmount)}
                            </td>
                            <td className="p-3 text-center text-xs">
                              {l.paidInstallments} / {l.totalInstallments} parcelas
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: PENSÕES */}
        <TabsContent value="pensions" className="space-y-4">
          <Card className="border-border/80 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Pensões Alimentícias Judiciais</CardTitle>
                <CardDescription>Visualização e controle de obrigações de desconto judicial por dependente cadastrado.</CardDescription>
              </div>
              {canOperate && (
                <Button onClick={() => {
                  if (employeesQuery.data?.length === 0) {
                    toast.error('Nenhum colaborador cadastrado.');
                    return;
                  }
                  setPensionForm({
                    employeeId: employeesQuery.data?.[0]?.id ?? '',
                    dependentId: 'dep-judicial',
                    percentage: '15.00',
                    baseType: 'NET',
                  });
                  setPensionOpen(true);
                }}>
                  <Plus className="mr-1 h-4 w-4" /> Vincular Pensão
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {pensionsQuery.isLoading ? (
                <div className="py-8 text-center text-muted-foreground">Carregando pensões vinculadas...</div>
              ) : (pensionsQuery.data?.length ?? 0) === 0 ? (
                <div className="py-8 text-center text-muted-foreground">Nenhuma pensão alimentícia vinculada no sistema.</div>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b font-semibold">
                      <tr>
                        <th className="p-3">Funcionário</th>
                        <th className="p-3">Ref. Dependente</th>
                        <th className="p-3 text-center">Percentual Judicial</th>
                        <th className="p-3 text-center">Base de Cálculo</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pensionsQuery.data?.map((p) => {
                        const emp = employeeMap.get(p.employeeId);
                        return (
                          <tr key={p.id} className="hover:bg-muted/10">
                            <td className="p-3 font-medium">
                              {emp?.name ?? 'Colaborador'}
                            </td>
                            <td className="p-3 text-xs">{p.dependentId}</td>
                            <td className="p-3 text-center font-bold text-sky-600 dark:text-sky-400">
                              {p.percentage}%
                            </td>
                            <td className="p-3 text-center text-xs">
                              {p.baseType === 'NET' ? 'Líquido (Bruto - INSS)' : 'Salário Bruto'}
                            </td>
                            <td className="p-3 text-center">
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-transparent dark:bg-emerald-950/20 dark:text-emerald-400">Ativa</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG: Novo Benefício */}
      <Dialog open={benefitOpen} onOpenChange={setBenefitOpen}>
        <DialogContent className="max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Heart className="h-5 w-5 text-sky-600" /> Cadastrar Benefício Padrão
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createBenefit.mutate(benefitForm); }} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Nome do Benefício</Label>
              <Input
                id="name"
                value={benefitForm.name}
                onChange={(e) => setBenefitForm({ ...benefitForm, name: e.target.value })}
                placeholder="Ex: Unimed Saúde Master"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="provider">Provedora / Operadora</Label>
              <Input
                id="provider"
                value={benefitForm.provider}
                onChange={(e) => setBenefitForm({ ...benefitForm, provider: e.target.value })}
                placeholder="Ex: Seguradora Unimed S/A"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="kind">Tipo / Categoria</Label>
                <NativeSelect
                  id="kind"
                  value={benefitForm.kind}
                  onChange={(e) => setBenefitForm({ ...benefitForm, kind: e.target.value })}
                >
                  <option value="VT">Vale Transporte (VT)</option>
                  <option value="VA">Vale Alimentação (VA)</option>
                  <option value="VR">Vale Refeição (VR)</option>
                  <option value="SAUDE">Plano de Saúde (SAÚDE)</option>
                  <option value="ODONTO">Plano Odontológico (ODONTO)</option>
                </NativeSelect>
              </div>
              <div className="space-y-1">
                <Label htmlFor="value">Custo Mensal (R$)</Label>
                <Input
                  id="value"
                  value={benefitForm.value}
                  onChange={(e) => setBenefitForm({ ...benefitForm, value: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="copayRateBp">Coparticipação do Funcionário (%)</Label>
              <Input
                id="copayRateBp"
                type="number"
                value={benefitForm.copayRateBp / 100}
                onChange={(e) => setBenefitForm({ ...benefitForm, copayRateBp: Math.round(Number(e.target.value) * 100) })}
                placeholder="Ex: 6 para VT padrão"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setBenefitOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createBenefit.isPending}>Salvar Benefício</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Associar Colaborador a Benefício */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Vincular Colaborador ao Benefício</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); enrollBenefit.mutate(enrollForm); }} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="employeeId">Selecione o Colaborador</Label>
              <NativeSelect
                id="employeeId"
                value={enrollForm.employeeId}
                onChange={(e) => setEnrollForm({ ...enrollForm, employeeId: e.target.value })}
              >
                {employeesQuery.data?.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label htmlFor="customValue">Valor Customizado (Deixar vazio para usar o custo padrão)</Label>
              <Input
                id="customValue"
                placeholder="Opcional"
                value={enrollForm.customValue}
                onChange={(e) => setEnrollForm({ ...enrollForm, customValue: e.target.value })}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEnrollOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={enrollBenefit.isPending}>Vincular Colaborador</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Novo Consignado */}
      <Dialog open={loanOpen} onOpenChange={setLoanOpen}>
        <DialogContent className="max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Banknote className="h-5 w-5 text-rose-500" /> Registrar Empréstimo Consignado
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createLoan.mutate(loanForm); }} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="loanEmployeeId">Colaborador</Label>
              <NativeSelect
                id="loanEmployeeId"
                value={loanForm.employeeId}
                onChange={(e) => setLoanForm({ ...loanForm, employeeId: e.target.value })}
              >
                {employeesQuery.data?.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label htmlFor="bankName">Instituição Financeira (Banco)</Label>
              <Input
                id="bankName"
                value={loanForm.bankName}
                onChange={(e) => setLoanForm({ ...loanForm, bankName: e.target.value })}
                placeholder="Ex: Caixa Econômica Federal"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contractId">Código / Identificador do Contrato</Label>
              <Input
                id="contractId"
                value={loanForm.contractId}
                onChange={(e) => setLoanForm({ ...loanForm, contractId: e.target.value })}
                placeholder="Ex: CEF-8829-22"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="totalAmount">Valor Total Financiado (R$)</Label>
                <Input
                  id="totalAmount"
                  value={loanForm.totalAmount}
                  onChange={(e) => setLoanForm({ ...loanForm, totalAmount: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="installmentAmount">Valor da Parcela Mensal (R$)</Label>
                <Input
                  id="installmentAmount"
                  value={loanForm.installmentAmount}
                  onChange={(e) => setLoanForm({ ...loanForm, installmentAmount: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="totalInstallments">Número Total de Parcelas</Label>
              <Input
                id="totalInstallments"
                type="number"
                value={loanForm.totalInstallments}
                onChange={(e) => setLoanForm({ ...loanForm, totalInstallments: Number(e.target.value) })}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setLoanOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createLoan.isPending}>Salvar Consignado</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Nova Pensão */}
      <Dialog open={pensionOpen} onOpenChange={setPensionOpen}>
        <DialogContent className="max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <ShieldAlert className="h-5 w-5 text-indigo-500" /> Vincular Pensão Alimentícia
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createPension.mutate(pensionForm); }} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="pensionEmployeeId">Colaborador Mandante</Label>
              <NativeSelect
                id="pensionEmployeeId"
                value={pensionForm.employeeId}
                onChange={(e) => setPensionForm({ ...pensionForm, employeeId: e.target.value })}
              >
                {employeesQuery.data?.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label htmlFor="dependentId">Identificação do Dependente / Ofício Judicial</Label>
              <Input
                id="dependentId"
                value={pensionForm.dependentId}
                onChange={(e) => setPensionForm({ ...pensionForm, dependentId: e.target.value })}
                placeholder="Ex: Dependente - Processo 00192-33"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="percentage">Alíquota Judicial (%)</Label>
                <Input
                  id="percentage"
                  value={pensionForm.percentage}
                  onChange={(e) => setPensionForm({ ...pensionForm, percentage: e.target.value })}
                  placeholder="Ex: 15.00"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="baseType">Base de Cálculo</Label>
                <NativeSelect
                  id="baseType"
                  value={pensionForm.baseType}
                  onChange={(e) => setPensionForm({ ...pensionForm, baseType: e.target.value })}
                >
                  <option value="NET">Líquido (Salário Bruto - INSS)</option>
                  <option value="GROSS">Salário Bruto Contratual</option>
                </NativeSelect>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setPensionOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createPension.isPending}>Salvar Vínculo Judicial</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
