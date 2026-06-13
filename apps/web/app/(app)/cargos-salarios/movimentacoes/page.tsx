'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { CompensationModuleNav } from '@/components/compensation/module-nav';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/utils';

interface OptionData {
  jobs: Array<{ id: string; name: string; orgJobId?: string | null }>;
}

interface StructureData {
  employees: Array<{ id: string; name: string; registrationId: string | null; jobId: string; band: string }>;
}

interface Movement {
  id: string;
  protocol: string;
  type: string;
  employeeId: string | null;
  currentBand: string | null;
  targetBand: string | null;
  currentSalary: string | null;
  proposedSalary: string | null;
  monthlyImpact: string | null;
  effectiveAt: string;
  status: string;
  reason: string;
  createdAt: string;
}

export default function MovimentacoesPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    type: 'PROMOCAO',
    employeeId: '',
    targetJobId: '',
    currentBand: '',
    targetBand: '',
    currentSalary: '',
    proposedSalary: '',
    availableBudget: '',
    effectiveAt: new Date().toISOString().slice(0, 10),
    reason: '',
    justification: '',
  });
  const optionsQuery = useQuery<OptionData>({ queryKey: ['compensation', 'options'], queryFn: () => api('/cargos-salarios/options') });
  const structureQuery = useQuery<StructureData>({ queryKey: ['compensation', 'estrutura-quadro'], queryFn: () => api('/cargos-salarios/estrutura-quadro') });
  const movementsQuery = useQuery<Movement[]>({ queryKey: ['compensation', 'movements'], queryFn: () => api('/cargos-salarios/movements') });
  const createMovement = useMutation({
    mutationFn: () => api('/cargos-salarios/movements', { method: 'POST', json: numericPayload(form) }),
    onSuccess: () => {
      toast.success('Movimentação solicitada');
      setForm({ type: 'PROMOCAO', employeeId: '', targetJobId: '', currentBand: '', targetBand: '', currentSalary: '', proposedSalary: '', availableBudget: '', effectiveAt: new Date().toISOString().slice(0, 10), reason: '', justification: '' });
      qc.invalidateQueries({ queryKey: ['compensation', 'movements'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao solicitar movimentação'),
  });

  const selectedEmployee = structureQuery.data?.employees.find((employee) => employee.id === form.employeeId);

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salários"
        title="Movimentações"
        description="Solicitacoes de promocao, enquadramento, transferencia, alteração de faixa e demais impactos no quadro."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Movimentações' }]}
      />
      <CompensationModuleNav />

      <SectionCard title="Nova solicitação">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div>
            <Label>Tipo</Label>
            <NativeSelect value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              <option value="ADMISSAO">Admissao</option>
              <option value="PROMOCAO">Promocao</option>
              <option value="MERITO">Mérito</option>
              <option value="ENQUADRAMENTO">Enquadramento</option>
              <option value="TRANSFERENCIA_AREA">Transferência de área</option>
              <option value="ALTERACAO_CARGO">Alteração de cargo</option>
              <option value="ALTERACAO_FAIXA">Alteração de faixa</option>
              <option value="DESLIGAMENTO">Desligamento</option>
            </NativeSelect>
          </div>
          <div>
            <Label>Colaborador</Label>
            <NativeSelect value={form.employeeId} onChange={(event) => {
              const employee = structureQuery.data?.employees.find((item) => item.id === event.target.value);
              setForm({ ...form, employeeId: event.target.value, currentBand: employee?.band ?? '', targetBand: employee?.band ?? '' });
            }}>
              <option value="">Selecione</option>
              {(structureQuery.data?.employees ?? []).filter((employee) => employee.name && employee.registrationId).map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.registrationId} - {employee.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>Cargo pretendido</Label>
            <NativeSelect value={form.targetJobId} onChange={(event) => setForm({ ...form, targetJobId: event.target.value })}>
              <option value="">Sem alteração</option>
              {(optionsQuery.data?.jobs ?? []).map((job) => <option key={job.id} value={job.orgJobId ?? job.id}>{job.name}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label>Vigência</Label>
            <Input type="date" value={form.effectiveAt} onChange={(event) => setForm({ ...form, effectiveAt: event.target.value })} />
          </div>
          <div>
            <Label>Faixa atual</Label>
            <Input value={form.currentBand || selectedEmployee?.band || ''} onChange={(event) => setForm({ ...form, currentBand: event.target.value })} />
          </div>
          <div>
            <Label>Faixa pretendida</Label>
            <Input value={form.targetBand} onChange={(event) => setForm({ ...form, targetBand: event.target.value })} />
          </div>
          <div>
            <Label>Salário atual</Label>
            <Input type="number" value={form.currentSalary} onChange={(event) => setForm({ ...form, currentSalary: event.target.value })} />
          </div>
          <div>
            <Label>Salário proposto</Label>
            <Input type="number" value={form.proposedSalary} onChange={(event) => setForm({ ...form, proposedSalary: event.target.value })} />
          </div>
          <div>
            <Label>Orçamento disponível</Label>
            <Input type="number" value={form.availableBudget} onChange={(event) => setForm({ ...form, availableBudget: event.target.value })} />
          </div>
          <div className="lg:col-span-3">
            <Label>Motivo</Label>
            <Input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
          </div>
          <div className="lg:col-span-4">
            <Label>Justificativa obrigatória</Label>
            <Textarea rows={3} value={form.justification} onChange={(event) => setForm({ ...form, justification: event.target.value })} />
          </div>
          <div className="lg:col-span-4">
            <Button onClick={() => createMovement.mutate()} disabled={!form.type || !form.reason || !form.justification || !form.effectiveAt || createMovement.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Solicitar
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Solicitacoes" className="mt-4">
        {movementsQuery.isLoading && <LoadingState />}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 text-left">Protocolo</th>
                <th className="py-2 text-left">Tipo</th>
                <th className="py-2 text-left">Vigência</th>
                <th className="py-2 text-left">Motivo</th>
                <th className="py-2 text-right">Impacto mensal</th>
                <th className="py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {(movementsQuery.data ?? []).map((movement) => (
                <tr key={movement.id} className="border-b border-border/60">
                  <td className="py-2 font-mono text-xs">{movement.protocol}</td>
                  <td className="py-2">{movement.type}</td>
                  <td className="py-2">{formatDate(movement.effectiveAt)}</td>
                  <td className="py-2">{movement.reason}</td>
                  <td className="py-2 text-right">{movement.monthlyImpact ? formatNumber(Number(movement.monthlyImpact), { style: 'currency', currency: 'BRL' }) : '-'}</td>
                  <td className="py-2"><Badge>{movement.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function numericPayload(form: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(form).map(([key, value]) => {
      if (['currentSalary', 'proposedSalary', 'availableBudget'].includes(key)) return [key, value ? Number(value) : undefined];
      return [key, value || undefined];
    }),
  );
}
