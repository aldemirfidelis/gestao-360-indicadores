'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

const schema = z.object({
  name: z.string().min(2),
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
    defaultValues: {
      name: '',
      type: 'OPERATIONAL',
      unit: 'PERCENT',
      periodicity: 'MONTHLY',
      direction: 'HIGHER_BETTER',
      weight: 1,
    },
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
      <Link
        href="/indicators"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Indicadores
      </Link>
      <PageHeader title="Novo indicador" description="Defina identificacao, periodicidade e direcao desejada." />

      <Card>
        <CardContent className="p-6">
          <form onSubmit={form.handleSubmit((d) => submit.mutate(d))} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Nome *</Label>
              <Input {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>
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
            <div>
              <Label>Area responsavel *</Label>
              <NativeSelect {...form.register('ownerNodeId')}>
                <option value="">Selecione...</option>
                {orgs.data?.map((n) => (
                  <option key={n.id} value={n.id}>{n.name} ({n.type})</option>
                ))}
              </NativeSelect>
              {form.formState.errors.ownerNodeId && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.ownerNodeId.message}</p>
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
              <Label>Rotulo da unidade (opcional)</Label>
              <Input placeholder="Ex.: R$/t" {...form.register('unitLabel')} />
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
            <div>
              <Label>Direcao desejada</Label>
              <NativeSelect {...form.register('direction')}>
                <option value="HIGHER_BETTER">Quanto maior, melhor</option>
                <option value="LOWER_BETTER">Quanto menor, melhor</option>
                <option value="EQUAL_TARGET">Igual a meta</option>
                <option value="RANGE">Faixa aceitavel</option>
              </NativeSelect>
            </div>
            <div className="md:col-span-2">
              <Label>Formula</Label>
              <Input placeholder="Ex.: (atendidos / total) * 100" {...form.register('formula')} />
            </div>
            <div className="md:col-span-2">
              <Label>Fonte dos dados</Label>
              <Input placeholder="Ex.: ERP modulo XYZ, planilha SST..." {...form.register('source')} />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => router.back()}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submit.isPending}>
                <Save className="h-4 w-4 mr-2" /> {submit.isPending ? 'Salvando...' : 'Criar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
