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
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const MANAGE_PERMS = ['compensation:manage', 'org:positions:manage'];

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
  const { hasPermission } = useAuth();
  const canManage = hasPermission(MANAGE_PERMS);
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
        description="Políticas e governança do módulo: diretriz de mérito, exigência de orçamento, visibilidade salarial e cadência de revisão."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Configurações' }]}
      />
      <CompensationModuleNav />

      {settingsQuery.isLoading && <LoadingState />}

      <SectionCard title="Governança salarial" description="Regras aplicadas a movimentações e tabelas salariais.">
        <fieldset disabled={!canManage} className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Field label="Diretriz padrão de mérito (%)" hint="Percentual de referência usado como guardrail nos ciclos de mérito.">
            <Input type="number" value={form.meritGuidelinePercent} onChange={(e) => setForm({ ...form, meritGuidelinePercent: e.target.value })} />
          </Field>
          <Field label="Revisão de descrições (meses)" hint="Periodicidade sugerida para revisar as descrições de cargo.">
            <Input type="number" value={form.reviewCadenceMonths} onChange={(e) => setForm({ ...form, reviewCadenceMonths: e.target.value })} />
          </Field>
          <Field label="Exigir orçamento nas movimentações" hint="Bloqueia movimentações com impacto acima do orçamento disponível.">
            <NativeSelect value={form.requireBudgetForMovements} onChange={(e) => setForm({ ...form, requireBudgetForMovements: e.target.value })}>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </NativeSelect>
          </Field>
          <Field label="Aprovação para publicar tabela" hint="Exige permissão de aprovação para publicar tabelas salariais.">
            <NativeSelect value={form.requireApprovalForSalaryTable} onChange={(e) => setForm({ ...form, requireApprovalForSalaryTable: e.target.value })}>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </NativeSelect>
          </Field>
          <Field label="Visibilidade salarial" hint="Define quem enxerga valores salariais individuais no módulo.">
            <NativeSelect value={form.salaryVisibility} onChange={(e) => setForm({ ...form, salaryVisibility: e.target.value })}>
              <option value="restricted">Restrita por permissão</option>
              <option value="management">Gestores e RH</option>
              <option value="open">Aberta para usuários do módulo</option>
            </NativeSelect>
          </Field>
        </fieldset>

        {canManage && (
          <div className="mt-5 flex items-center justify-between border-t pt-4">
            <span className="text-xs text-muted-foreground">Última atualização: {formatDate(settingsQuery.data?.updatedAt)}</span>
            <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
              <Save className="mr-2 h-4 w-4" /> Salvar configurações
            </Button>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
