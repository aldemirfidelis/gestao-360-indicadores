'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Ban, Building2, CheckCircle2, Pencil, Plus, RefreshCcw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { SectionCard } from '@/components/platform/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type CompanyStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

interface CompanyUsage {
  users: number;
  indicators: number;
  openActions: number;
  lastAccessAt: string | null;
}
interface Company {
  id: string;
  name: string;
  tradeName: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  segment: string | null;
  maxUsers: number | null;
  notes: string | null;
  status: CompanyStatus;
  areaAccessEnabled: boolean;
  createdAt: string;
  usage: CompanyUsage;
}
interface Overview {
  companies: number;
  active: number;
  suspended: number;
  inactive: number;
  totalUsers: number;
  activeUsers: number;
}

const STATUS_BADGE: Record<CompanyStatus, string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-600 border-transparent',
  SUSPENDED: 'bg-amber-500/10 text-amber-600 border-transparent',
  INACTIVE: 'bg-muted text-muted-foreground border-transparent',
};
const STATUS_LABEL: Record<CompanyStatus, string> = {
  ACTIVE: 'Ativa',
  SUSPENDED: 'Suspensa',
  INACTIVE: 'Inativa',
};

export default function PlataformaPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Company | null>(null);
  const [creating, setCreating] = useState(false);

  const overview = useQuery<Overview>({ queryKey: ['platform-overview'], queryFn: () => api('/platform/overview') });
  const companies = useQuery<Company[]>({ queryKey: ['platform-companies'], queryFn: () => api('/platform/companies') });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CompanyStatus }) =>
      api(`/platform/companies/${id}/status`, { method: 'PATCH', json: { status } }),
    onSuccess: () => {
      toast.success('Status atualizado.');
      qc.invalidateQueries({ queryKey: ['platform-companies'] });
      qc.invalidateQueries({ queryKey: ['platform-overview'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao alterar status'),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administração Geral"
        tone="admin"
        title="Plataforma"
        description="Gestão global de empresas (Super Admin). Cada empresa permanece isolada."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nova empresa
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard title="Empresas" value={overview.data?.companies ?? '—'} icon={<Building2 className="h-4 w-4" />} />
        <MetricCard title="Ativas" value={overview.data?.active ?? '—'} tone="green" />
        <MetricCard title="Suspensas" value={overview.data?.suspended ?? '—'} tone="yellow" />
        <MetricCard title="Inativas" value={overview.data?.inactive ?? '—'} />
        <MetricCard title="Usuários" value={overview.data?.totalUsers ?? '—'} icon={<Users className="h-4 w-4" />} />
        <MetricCard title="Usuários ativos" value={overview.data?.activeUsers ?? '—'} tone="green" />
      </div>

      <SectionCard title="Empresas cadastradas" description="Uso e status de cada empresa." contentClassName="p-0">
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th className="text-left">Empresa</th>
                <th className="text-left">Status</th>
                <th className="text-left">Usuários</th>
                <th className="text-left">Indicadores</th>
                <th className="text-left">Ações abertas</th>
                <th className="text-left">Último acesso</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {companies.isLoading && (
                <tr><td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Carregando empresas...</td></tr>
              )}
              {companies.data?.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.tradeName ?? c.cnpj ?? c.segment ?? ''}</div>
                  </td>
                  <td><Badge className={cn('text-[10px]', STATUS_BADGE[c.status])}>{STATUS_LABEL[c.status]}</Badge></td>
                  <td className="text-sm">{c.usage.users}{c.maxUsers ? ` / ${c.maxUsers}` : ''}</td>
                  <td className="text-sm">{c.usage.indicators}</td>
                  <td className="text-sm">{c.usage.openActions}</td>
                  <td className="text-xs text-muted-foreground">
                    {c.usage.lastAccessAt ? formatDistanceToNow(new Date(c.usage.lastAccessAt), { addSuffix: true, locale: ptBR }) : '—'}
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {c.status === 'ACTIVE' ? (
                        <Button size="sm" variant="ghost" className="h-8 text-amber-600" title="Suspender"
                          onClick={() => setStatus.mutate({ id: c.id, status: 'SUSPENDED' })} disabled={setStatus.isPending}>
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-8 text-emerald-600" title="Reativar"
                          onClick={() => setStatus.mutate({ id: c.id, status: 'ACTIVE' })} disabled={setStatus.isPending}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!companies.isLoading && (companies.data?.length ?? 0) === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Nenhuma empresa cadastrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {(creating || editing) && (
        <CompanyDialog
          company={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => {
            setCreating(false); setEditing(null);
            qc.invalidateQueries({ queryKey: ['platform-companies'] });
            qc.invalidateQueries({ queryKey: ['platform-overview'] });
          }}
        />
      )}
    </div>
  );
}

function CompanyDialog({ company, onClose, onSaved }: { company: Company | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!company;
  const [form, setForm] = useState({
    name: company?.name ?? '',
    tradeName: company?.tradeName ?? '',
    cnpj: company?.cnpj ?? '',
    email: company?.email ?? '',
    phone: company?.phone ?? '',
    segment: company?.segment ?? '',
    city: company?.city ?? '',
    state: company?.state ?? '',
    addressLine: company?.addressLine ?? '',
    maxUsers: company?.maxUsers?.toString() ?? '',
    status: (company?.status ?? 'ACTIVE') as CompanyStatus,
    areaAccessEnabled: company?.areaAccessEnabled ?? true,
    notes: company?.notes ?? '',
  });
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        tradeName: form.tradeName || undefined,
        cnpj: form.cnpj || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        segment: form.segment || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        addressLine: form.addressLine || undefined,
        maxUsers: form.maxUsers ? Number(form.maxUsers) : undefined,
        status: form.status,
        areaAccessEnabled: form.areaAccessEnabled,
        notes: form.notes || undefined,
      };
      return isEdit
        ? api(`/platform/companies/${company!.id}`, { method: 'PATCH', json: payload })
        : api('/platform/companies', { method: 'POST', json: payload });
    },
    onSuccess: () => { toast.success(isEdit ? 'Empresa atualizada.' : 'Empresa criada.'); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao salvar empresa'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar empresa' : 'Nova empresa'}</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto py-1 sm:grid-cols-2">
          <Field label="Razão social *" className="sm:col-span-2"><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Nome fantasia"><Input value={form.tradeName} onChange={(e) => set('tradeName', e.target.value)} /></Field>
          <Field label="CNPJ"><Input value={form.cnpj} onChange={(e) => set('cnpj', e.target.value)} /></Field>
          <Field label="E-mail principal"><Input value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Telefone"><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="Segmento"><Input value={form.segment} onChange={(e) => set('segment', e.target.value)} /></Field>
          <Field label="Máx. de usuários"><Input type="number" value={form.maxUsers} onChange={(e) => set('maxUsers', e.target.value)} /></Field>
          <Field label="Cidade"><Input value={form.city} onChange={(e) => set('city', e.target.value)} /></Field>
          <Field label="Estado"><Input value={form.state} onChange={(e) => set('state', e.target.value)} /></Field>
          <Field label="Endereço" className="sm:col-span-2"><Input value={form.addressLine} onChange={(e) => set('addressLine', e.target.value)} /></Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => set('status', e.target.value)} className="h-10 w-full rounded-md border border-border/60 bg-background px-2 text-sm">
              <option value="ACTIVE">Ativa</option>
              <option value="SUSPENDED">Suspensa</option>
              <option value="INACTIVE">Inativa</option>
            </select>
          </Field>
          <Field label="Restrição por área">
            <label className="flex h-10 items-center gap-2 text-sm">
              <input type="checkbox" checked={form.areaAccessEnabled} onChange={(e) => set('areaAccessEnabled', e.target.checked)} className="h-4 w-4 accent-foreground" />
              Aplicar visibilidade por área
            </label>
          </Field>
          <Field label="Observações administrativas" className="sm:col-span-2">
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className="w-full rounded-md border border-border/60 bg-background p-2 text-sm" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>
            <RefreshCcw className={cn('mr-2 h-4 w-4', save.isPending && 'animate-spin')} />
            {isEdit ? 'Salvar' : 'Criar empresa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
