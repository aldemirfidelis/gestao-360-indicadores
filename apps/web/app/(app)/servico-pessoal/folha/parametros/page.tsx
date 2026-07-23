'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  FileCode,
  FilePlus,
  FileText,
  HelpCircle,
  History,
  Lock,
  Plus,
  RefreshCw,
  Scale,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatCurrency } from '@/components/payroll/payslip-card';

interface LegalVersion {
  id: string;
  companyId: string | null;
  kind: 'INSS' | 'IRRF' | 'FGTS' | 'SALARIO_MINIMO' | 'SALARIO_FAMILIA';
  effectiveFrom: string;
  data: any;
  source: string | null;
  active: boolean;
  createdAt: string;
}

interface Rubric {
  id: string;
  code: string;
  name: string;
  nature: string;
  versions: Array<{
    id: string;
    version: number;
    spec: any;
    effectiveFrom: string;
  }>;
}

interface CompanySettings {
  dsrOnVariables: boolean;
  legalTablesConfirmedAt: string | null;
  legalTablesConfirmedById: string | null;
  legalTablesConfirmNote: string | null;
}

export default function ParametersPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('legal');
  const [newVersionOpen, setNewVersionOpen] = useState(false);

  const [form, setForm] = useState({
    kind: 'SALARIO_MINIMO',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    source: '',
    dataJson: '{\n  "valueCents": 151800\n}',
  });

  const [confirmNote, setConfirmNote] = useState('');

  const legalQuery = useQuery<LegalVersion[]>({
    queryKey: ['payroll-legal-tables'],
    queryFn: () => api<LegalVersion[]>('/payroll/legal-tables'),
  });

  const settingsQuery = useQuery<CompanySettings>({
    queryKey: ['payroll-company-settings'],
    queryFn: () => api<CompanySettings>('/payroll/company-settings'),
  });

  const updateSettings = useMutation({
    mutationFn: (json: any) => api<CompanySettings>('/payroll/company-settings', { method: 'PATCH', json }),
    onSuccess: () => {
      toast.success('Parâmetros da empresa atualizados.');
      setConfirmNote('');
      void qc.invalidateQueries({ queryKey: ['payroll-company-settings'] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao atualizar parâmetros da empresa.'),
  });

  const rubricsQuery = useQuery<Rubric[]>({
    queryKey: ['payroll-rubrics'],
    queryFn: () => api<Rubric[]>('/payroll/rubrics'),
  });

  const createVersion = useMutation({
    mutationFn: (payload: { kind: string; effectiveFrom: string; source: string; data: any }) =>
      api('/payroll/legal-tables', { method: 'POST', json: payload }),
    onSuccess: () => {
      toast.success('Nova versão de parâmetro legal criada com sucesso.');
      setNewVersionOpen(false);
      void qc.invalidateQueries({ queryKey: ['payroll-legal-tables'] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao salvar parâmetro.'),
  });

  const handleKindChange = (kind: string) => {
    let defaultJson = '';
    if (kind === 'SALARIO_MINIMO') {
      defaultJson = '{\n  "valueCents": 151800\n}';
    } else if (kind === 'SALARIO_FAMILIA') {
      defaultJson = '{\n  "quotaCents": 6500,\n  "remunerationCapCents": 190604\n}';
    } else if (kind === 'FGTS') {
      defaultJson = '{\n  "rateBp": 800,\n  "apprenticeRateBp": 200\n}';
    } else if (kind === 'INSS') {
      defaultJson = '{\n  "brackets": [\n    { "upToCents": 151800, "rateBp": 750 },\n    { "upToCents": 279388, "rateBp": 900 },\n    { "upToCents": 419083, "rateBp": 1200 },\n    { "upToCents": 815741, "rateBp": 1400 }\n  ]\n}';
    } else if (kind === 'IRRF') {
      defaultJson = '{\n  "brackets": [\n    { "upToCents": 242880, "rateBp": 0, "deductionCents": 0 },\n    { "upToCents": 282665, "rateBp": 750, "deductionCents": 18216 },\n    { "upToCents": 375105, "rateBp": 1500, "deductionCents": 39416 },\n    { "upToCents": 466468, "rateBp": 2250, "deductionCents": 67549 },\n    { "upToCents": null, "rateBp": 2750, "deductionCents": 90873 }\n  ],\n  "dependentDeductionCents": 18959,\n  "simplifiedDiscountCents": 60720\n}';
    }
    setForm({ ...form, kind, dataJson: defaultJson });
  };

  const handleConfirmCreate = () => {
    try {
      const parsedData = JSON.parse(form.dataJson);
      createVersion.mutate({
        kind: form.kind,
        effectiveFrom: form.effectiveFrom,
        source: form.source,
        data: parsedData,
      });
    } catch {
      toast.error('JSON de dados inválido. Corrija o formato antes de prosseguir.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/servico-pessoal/folha" className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar para a Folha
        </Link>
      </div>

      <PageHeader
        title="Parâmetros de Folha"
        description="Versionamento e cadastro de alíquotas legais, bases de cálculo e catálogo de rubricas"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setNewVersionOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" /> Criar Parâmetro
            </Button>
          </div>
        }
      />

      {/* Parâmetros por empresa (SaaS): conferência da contabilidade + DSR */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={settingsQuery.data?.legalTablesConfirmedAt ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/50 bg-amber-500/5'}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Scale className="h-4 w-4" />
              Conferência da Contabilidade
              {settingsQuery.data?.legalTablesConfirmedAt ? (
                <Badge className="bg-emerald-600 text-white text-[9px] uppercase">Conferido</Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 text-[9px] uppercase">Pendente</Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              A plataforma entrega as tabelas legais nacionais (INSS/IRRF/FGTS) prontas. Antes do primeiro fechamento
              oficial, a contabilidade da sua empresa deve conferi-las (e criar overrides se necessário).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {settingsQuery.data?.legalTablesConfirmedAt ? (
              <div className="text-emerald-700 dark:text-emerald-400">
                Conferidas em {new Date(settingsQuery.data.legalTablesConfirmedAt).toLocaleDateString('pt-BR')}
                {settingsQuery.data.legalTablesConfirmNote ? ` — “${settingsQuery.data.legalTablesConfirmNote}”` : ''}
                <div className="mt-2">
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={updateSettings.isPending} onClick={() => updateSettings.mutate({ confirmLegalTables: true, confirmNote: 'Reconferência após atualização de tabelas' })}>
                    Registrar nova conferência
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  className="h-8 text-xs"
                  value={confirmNote}
                  onChange={(e) => setConfirmNote(e.target.value)}
                  placeholder="Nota da conferência (ex.: conferido pela Contabilidade XYZ) — opcional"
                />
                <Button size="sm" className="h-8" disabled={updateSettings.isPending} onClick={() => updateSettings.mutate({ confirmLegalTables: true, confirmNote })}>
                  Marcar tabelas como conferidas
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4" />
              DSR sobre variáveis (HE e adicional noturno)
              <Badge variant={settingsQuery.data?.dsrOnVariables ? 'default' : 'outline'} className="text-[9px] uppercase">
                {settingsQuery.data?.dsrOnVariables ? 'Ativado' : 'Desativado'}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Reflexo do repouso semanal remunerado sobre horas extras e adicional noturno (Lei 605/49): variáveis ÷
              dias úteis × domingos/feriados do mês (feriados vêm do calendário do Controle de Ponto). A regra pode
              variar por CCT — ative somente após validação da contabilidade.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              size="sm"
              variant={settingsQuery.data?.dsrOnVariables ? 'outline' : 'default'}
              className="h-8"
              disabled={updateSettings.isPending || settingsQuery.isLoading}
              onClick={() => updateSettings.mutate({ dsrOnVariables: !settingsQuery.data?.dsrOnVariables })}
            >
              {settingsQuery.data?.dsrOnVariables ? 'Desativar DSR sobre variáveis' : 'Ativar DSR sobre variáveis'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="legal" onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/40 p-1 border border-border/60">
          <TabsTrigger value="legal" className="text-xs">Tabelas Legais (INSS, IRRF, Mínimo)</TabsTrigger>
          <TabsTrigger value="rubrics" className="text-xs">Catálogo de Rubricas</TabsTrigger>
        </TabsList>

        {/* Tabelas Legais */}
        <TabsContent value="legal">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {legalQuery.isLoading && (
              <div className="py-8 text-center text-muted-foreground col-span-full">Carregando tabelas...</div>
            )}
            {legalQuery.data?.map((version) => (
              <Card key={version.id} className="border-border/60 bg-card/60">
                <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-bold text-foreground">{version.kind}</CardTitle>
                      <Badge variant={version.companyId ? 'outline' : 'secondary'} className="text-[9px] uppercase">
                        {version.companyId ? 'Override Empresa' : 'Nacional'}
                      </Badge>
                    </div>
                    <CardDescription className="text-[10px] font-mono">
                      Vigência: {version.effectiveFrom}
                    </CardDescription>
                  </div>
                  <History className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="bg-muted/30 rounded p-2.5 font-mono text-[10px] whitespace-pre-wrap max-h-36 overflow-y-auto border border-border/40">
                    {JSON.stringify(version.data, null, 2)}
                  </div>
                  {version.source && (
                    <div className="text-[10px] text-muted-foreground flex gap-1 items-start">
                      <Scale className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span>{version.source}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Catálogo de Rubricas */}
        <TabsContent value="rubrics">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle>Rubricas Ativas</CardTitle>
              <CardDescription>Definições de proventos e descontos aplicados nos lotes</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/60 text-xs">
                {rubricsQuery.isLoading && (
                  <div className="py-8 text-center text-muted-foreground">Carregando rubricas...</div>
                )}
                {rubricsQuery.data?.map((rubric) => (
                  <div key={rubric.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-muted-foreground">{rubric.code}</span>
                        <span className="font-bold text-sm uppercase text-foreground">{rubric.name}</span>
                        <Badge variant="outline" className="text-[9px] uppercase">
                          {rubric.nature}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        Vigência: {rubric.versions[0]?.effectiveFrom || '—'} · Fórmula: {rubric.versions[0]?.spec?.engine || 'MOTOR_F1'}
                      </p>
                    </div>
                    {rubric.versions[0]?.spec?.description && (
                      <span className="text-muted-foreground italic text-xs max-w-xs truncate">
                        “{rubric.versions[0].spec.description}”
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG: Nova Versão Legal */}
      <Dialog open={newVersionOpen} onOpenChange={setNewVersionOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Novo Parâmetro Legal</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-3 text-xs">
            <div className="grid grid-cols-4 items-center gap-3">
              <Label htmlFor="kind" className="text-right">Tipo</Label>
              <NativeSelect
                id="kind"
                className="col-span-3"
                value={form.kind}
                onChange={(e) => handleKindChange(e.target.value)}
              >
                <option value="SALARIO_MINIMO">Salário Mínimo</option>
                <option value="SALARIO_FAMILIA">Salário Família</option>
                <option value="FGTS">FGTS Alíquotas</option>
                <option value="INSS">INSS Progressivo</option>
                <option value="IRRF">IRRF Progressivo</option>
              </NativeSelect>
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <Label htmlFor="effectiveFrom" className="text-right">Vigência</Label>
              <Input
                id="effectiveFrom"
                className="col-span-3 h-8 text-xs font-mono"
                value={form.effectiveFrom}
                onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                placeholder="YYYY-MM-DD"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <Label htmlFor="source" className="text-right">Fonte Oficial</Label>
              <Input
                id="source"
                className="col-span-3 h-8 text-xs"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                placeholder="Ex: Lei 14.XXX, Portaria MPS/MF..."
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="dataJson">Estrutura de Dados (JSON)</Label>
              <textarea
                id="dataJson"
                rows={7}
                className="w-full bg-muted/30 text-foreground font-mono text-[10px] p-2 rounded border border-border/60 focus:outline-none"
                value={form.dataJson}
                onChange={(e) => setForm({ ...form, dataJson: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewVersionOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmCreate} disabled={createVersion.isPending}>
              {createVersion.isPending ? 'Salvando...' : 'Salvar Versão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
