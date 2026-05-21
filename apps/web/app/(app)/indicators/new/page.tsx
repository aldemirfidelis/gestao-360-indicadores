'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, RotateCcw, Save } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { FormActions, FormSection } from '@/components/platform/form-section';
import { MetricCard } from '@/components/platform/metric-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { formatNumber } from '@/lib/utils';

const schema = z.object({
  name: z.string().min(2, 'Informe o nome do indicador'),
  code: z.string().optional(),
  description: z.string().optional(),
  ownerNodeId: z.string().min(1, 'Selecione uma area'),
  responsibleUserId: z.string().optional(),
  type: z.string(),
  unit: z.string(),
  unitLabel: z.string().optional(),
  periodicity: z.string(),
  direction: z.string(),
  formula: z.string().optional(),
  source: z.string().optional(),
  weight: z.coerce.number().min(0).max(10).default(1),
});
type Form = z.infer<typeof schema>;

interface OrgNode { id: string; name: string; type: string }
interface UserRow { id: string; name: string }

const defaultValues: Form = {
  name: '',
  code: '',
  description: '',
  ownerNodeId: '',
  responsibleUserId: '',
  type: 'OPERATIONAL',
  unit: 'PERCENT',
  unitLabel: '',
  periodicity: 'MONTHLY',
  direction: 'HIGHER_BETTER',
  formula: '',
  source: '',
  weight: 1,
};

export default function NewIndicatorPage() {
  const router = useRouter();
  const { user } = useAuth();

  const orgs = useQuery<OrgNode[]>({
    queryKey: ['orgnodes'],
    queryFn: () => api<OrgNode[]>('/orgnodes'),
  });
  const users = useQuery<UserRow[]>({
    queryKey: ['users'],
    queryFn: () => api<UserRow[]>('/users'),
  });

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const submit = useMutation({
    mutationFn: (data: Form) =>
      api<{ id: string }>('/indicators', {
        method: 'POST',
        json: { ...data, companyId: user?.companyId },
      }),
    onSuccess: (out) => {
      toast.success('Indicador criado');
      router.push(`/indicators/${out.id}`);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao criar'),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Lancamentos"
        tone="launch"
        title="Cadastro de indicador"
        description="Defina identificacao, responsavel, periodicidade, unidade e regra de medicao."
        breadcrumbs={[
          { label: 'Inicio', href: '/' },
          { label: 'Lancamentos', href: '/launches' },
          { label: 'Novo indicador' },
        ]}
        actions={
          <Button variant="outline" asChild>
            <Link href="/indicators">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard title="Areas" value={formatNumber(orgs.data?.length)} description="Estruturas disponiveis" tone="blue" />
        <MetricCard title="Responsaveis" value={formatNumber(users.data?.length)} description="Usuarios ativos" tone="purple" />
        <MetricCard title="Status inicial" value="Ativo" description="Acompanhamento mensal" tone="green" />
      </div>

      <form onSubmit={form.handleSubmit((d) => submit.mutate(d))} className="space-y-5">
        <FormSection title="Dados principais" description="Identificacao e contexto corporativo do indicador.">
          <div className="md:col-span-2">
            <Label className="field-required">Nome</Label>
            <Input {...form.register('name')} placeholder="Ex.: Indice de atendimento no prazo" />
            {form.formState.errors.name && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div>
            <Label>Codigo</Label>
            <Input placeholder="Ex.: RH-005" {...form.register('code')} />
          </div>
          <div>
            <Label>Peso</Label>
            <Input type="number" step="0.5" {...form.register('weight')} />
          </div>
          <div className="md:col-span-2">
            <Label>Descricao</Label>
            <Textarea rows={3} {...form.register('description')} />
          </div>
        </FormSection>

        <FormSection title="Governanca" description="Area proprietaria e responsavel pelo acompanhamento.">
          <div>
            <Label className="field-required">Area responsavel</Label>
            <NativeSelect {...form.register('ownerNodeId')}>
              <option value="">Selecione...</option>
              {orgs.data?.map((n) => (
                <option key={n.id} value={n.id}>{n.name} ({n.type})</option>
              ))}
            </NativeSelect>
            {form.formState.errors.ownerNodeId && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.ownerNodeId.message}</p>
            )}
          </div>
          <div>
            <Label>Responsavel</Label>
            <NativeSelect {...form.register('responsibleUserId')}>
              <option value="">Selecione...</option>
              {users.data?.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>Tipo</Label>
            <NativeSelect {...form.register('type')}>
              {[
                ['STRATEGIC', 'Estrategico'],
                ['TACTICAL', 'Tatico'],
                ['OPERATIONAL', 'Operacional'],
                ['PROJECT', 'Projeto'],
                ['PROCESS', 'Processo'],
                ['SAFETY', 'Seguranca'],
                ['QUALITY', 'Qualidade'],
                ['HR', 'RH'],
                ['FINANCE', 'Financeiro'],
                ['PRODUCTION', 'Producao'],
                ['MAINTENANCE', 'Manutencao'],
                ['PROCUREMENT', 'Suprimentos'],
                ['COMMERCIAL', 'Comercial'],
                ['CUSTOM', 'Personalizado'],
              ].map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>Periodicidade</Label>
            <NativeSelect {...form.register('periodicity')}>
              {[
                ['DAILY', 'Diario'],
                ['WEEKLY', 'Semanal'],
                ['BIWEEKLY', 'Quinzenal'],
                ['MONTHLY', 'Mensal'],
                ['QUARTERLY', 'Trimestral'],
                ['SEMIANNUAL', 'Semestral'],
                ['ANNUAL', 'Anual'],
              ].map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </NativeSelect>
          </div>
        </FormSection>

        <FormSection title="Medicao e calculo" description="Unidade, sentido do indicador, formula e origem dos dados.">
          <div>
            <Label>Unidade</Label>
            <NativeSelect {...form.register('unit')}>
              {[
                ['PERCENT', '%'],
                ['CURRENCY', 'R$'],
                ['QUANTITY', 'Quantidade'],
                ['HOURS', 'Horas'],
                ['DAYS', 'Dias'],
                ['TONS', 'Toneladas'],
                ['LITERS', 'Litros'],
                ['INDEX', 'Indice'],
                ['TEXT', 'Texto'],
                ['CUSTOM', 'Personalizada'],
              ].map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>Rotulo da unidade</Label>
            <Input placeholder="Ex.: R$/t" {...form.register('unitLabel')} />
          </div>
          <div>
            <Label>Direcao desejada</Label>
            <NativeSelect {...form.register('direction')}>
              <option value="HIGHER_BETTER">Quanto maior, melhor</option>
              <option value="LOWER_BETTER">Quanto menor, melhor</option>
              <option value="EQUAL_TARGET">Igual a meta</option>
              <option value="RANGE">Faixa aceitavel</option>
            </NativeSelect>
          </div>
          <div>
            <Label>Fonte dos dados</Label>
            <Input placeholder="Ex.: ERP, planilha, modulo interno" {...form.register('source')} />
          </div>
          <div className="md:col-span-2">
            <Label>Formula</Label>
            <Input placeholder="Ex.: (atendidos / total) * 100" {...form.register('formula')} />
          </div>
        </FormSection>

        <FormActions>
          <Button type="button" variant="outline" onClick={() => form.reset(defaultValues)}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Limpar
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submit.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {submit.isPending ? 'Salvando...' : 'Salvar indicador'}
          </Button>
        </FormActions>
      </form>
    </div>
  );
}
