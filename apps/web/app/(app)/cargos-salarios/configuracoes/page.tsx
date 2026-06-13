'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { CompensationModuleNav } from '@/components/compensation/module-nav';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface SettingsResponse {
  key: string;
  settings: {
    meritGuidelinePercent: number;
    requireBudgetForMovements: boolean;
    requireApprovalForSalaryTable: boolean;
    salaryVisibility: string;
    reviewCadenceMonths: number;
  };
  updatedAt: string | null;
}

export default function ConfiguracoesCargosSalariosPage() {
  const qc = useQueryClient();
  const settingsQuery = useQuery<SettingsResponse>({ queryKey: ['compensation', 'settings'], queryFn: () => api('/cargos-salarios/settings') });
  const settings = settingsQuery.data?.settings;
  const [form, setForm] = useState({
    meritGuidelinePercent: '5',
    requireBudgetForMovements: 'true',
    requireApprovalForSalaryTable: 'true',
    salaryVisibility: 'restricted',
    reviewCadenceMonths: '12',
  });

  useEffect(() => {
    if (!settings) return;
    setForm({
      meritGuidelinePercent: String(Number(settings.meritGuidelinePercent ?? 0) * 100),
      requireBudgetForMovements: String(Boolean(settings.requireBudgetForMovements)),
      requireApprovalForSalaryTable: String(Boolean(settings.requireApprovalForSalaryTable)),
      salaryVisibility: settings.salaryVisibility ?? 'restricted',
      reviewCadenceMonths: String(settings.reviewCadenceMonths ?? 12),
    });
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: () =>
      api('/cargos-salarios/settings', {
        method: 'PATCH',
        json: {
          meritGuidelinePercent: Number(form.meritGuidelinePercent || 0) / 100,
          requireBudgetForMovements: form.requireBudgetForMovements === 'true',
          requireApprovalForSalaryTable: form.requireApprovalForSalaryTable === 'true',
          salaryVisibility: form.salaryVisibility,
          reviewCadenceMonths: Number(form.reviewCadenceMonths || 12),
        },
      }),
    onSuccess: () => {
      toast.success('Configurações salvas');
      qc.invalidateQueries({ queryKey: ['compensation', 'settings'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao salvar configurações'),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salários"
        title="Configurações"
        description="Parâmetros operacionais do módulo de cargos, salários, movimentações e governança salarial."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Configurações' }]}
      />
      <CompensationModuleNav />

      {settingsQuery.isLoading && <LoadingState />}
      <SectionCard title="Parâmetros do módulo" description={`Última atualização: ${formatDate(settingsQuery.data?.updatedAt)}`}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div>
            <Label>Diretriz padrão de mérito (%)</Label>
            <Input type="number" value={form.meritGuidelinePercent} onChange={(event) => setForm({ ...form, meritGuidelinePercent: event.target.value })} />
          </div>
          <div>
            <Label>Exigir orçamento nas movimentações</Label>
            <NativeSelect value={form.requireBudgetForMovements} onChange={(event) => setForm({ ...form, requireBudgetForMovements: event.target.value })}>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </NativeSelect>
          </div>
          <div>
            <Label>Aprovação para publicar tabela</Label>
            <NativeSelect value={form.requireApprovalForSalaryTable} onChange={(event) => setForm({ ...form, requireApprovalForSalaryTable: event.target.value })}>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </NativeSelect>
          </div>
          <div>
            <Label>Visibilidade salarial</Label>
            <NativeSelect value={form.salaryVisibility} onChange={(event) => setForm({ ...form, salaryVisibility: event.target.value })}>
              <option value="restricted">Restrita por permissão</option>
              <option value="management">Gestores e RH</option>
              <option value="open">Aberta para usuários do módulo</option>
            </NativeSelect>
          </div>
          <div>
            <Label>Revisão de descricoes (meses)</Label>
            <Input type="number" value={form.reviewCadenceMonths} onChange={(event) => setForm({ ...form, reviewCadenceMonths: event.target.value })} />
          </div>
          <div className="flex items-end">
            <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Salvar configurações
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
