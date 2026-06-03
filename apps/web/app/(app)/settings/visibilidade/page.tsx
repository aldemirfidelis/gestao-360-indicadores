'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Plus, ShieldCheck, Trash2, UserCog, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Area { id: string; name: string; type: string; parentId: string | null }
interface DirUser { id: string; name: string; email: string; role: string }
interface Rule {
  id: string; sourceAreaId: string; targetAreaId: string; sourceAreaName: string; targetAreaName: string;
  moduleKey: string; visibilityLevel: string;
  canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; canApprove: boolean; canExport: boolean;
}
interface Simulation {
  context: { role: string; companyWide: boolean; areaAccessEnabled: boolean; primaryArea: string | null; ownAreas: string[] };
  perModule: { module: string; view: string; edit: string }[];
}
interface UserAreas {
  primaryAreaId: string | null;
  assignments: { id: string; orgNodeId: string; assignmentType: string; isPrimary: boolean }[];
}

const LEVELS = ['NONE', 'SUMMARY', 'FULL', 'CREATE', 'EDIT', 'APPROVE', 'DELETE', 'ADMIN'];
const LEVEL_COLOR: Record<string, string> = {
  NONE: 'bg-muted text-muted-foreground',
  SUMMARY: 'bg-blue-500/10 text-blue-600',
  FULL: 'bg-emerald-500/10 text-emerald-600',
  CREATE: 'bg-amber-500/10 text-amber-600',
  EDIT: 'bg-amber-500/10 text-amber-600',
  APPROVE: 'bg-amber-500/10 text-amber-600',
  DELETE: 'bg-rose-500/10 text-rose-600',
  ADMIN: 'bg-rose-600/10 text-rose-700',
};

export default function VisibilidadePage() {
  const qc = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string>('');

  const areas = useQuery<Area[]>({ queryKey: ['access-areas'], queryFn: () => api('/access/areas') });
  const modules = useQuery<string[]>({ queryKey: ['access-modules'], queryFn: () => api('/access/modules') });
  const users = useQuery<DirUser[]>({ queryKey: ['users-list'], queryFn: () => api('/users') });
  const matrix = useQuery<Rule[]>({ queryKey: ['access-matrix'], queryFn: () => api('/access/matrix') });

  const areaName = useMemo(() => new Map((areas.data ?? []).map((a) => [a.id, a.name])), [areas.data]);

  const simulation = useQuery<Simulation>({
    queryKey: ['access-simulate', selectedUser],
    queryFn: () => api(`/access/simulate/${selectedUser}`),
    enabled: !!selectedUser,
  });
  const userAreas = useQuery<UserAreas>({
    queryKey: ['access-user-areas', selectedUser],
    queryFn: () => api(`/access/users/${selectedUser}/areas`),
    enabled: !!selectedUser,
  });

  const refreshUser = () => {
    qc.invalidateQueries({ queryKey: ['access-simulate', selectedUser] });
    qc.invalidateQueries({ queryKey: ['access-user-areas', selectedUser] });
  };

  const deleteRule = useMutation({
    mutationFn: (id: string) => api(`/access/matrix/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Regra removida.'); qc.invalidateQueries({ queryKey: ['access-matrix'] }); },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao remover'),
  });
  const addAssignment = useMutation({
    mutationFn: (orgNodeId: string) => api(`/access/users/${selectedUser}/areas`, { method: 'POST', json: { orgNodeId, assignmentType: 'SECONDARY' } }),
    onSuccess: () => { toast.success('Área adicionada.'); refreshUser(); },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  });
  const removeAssignment = useMutation({
    mutationFn: (orgNodeId: string) => api(`/access/users/${selectedUser}/areas/${orgNodeId}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Área removida.'); refreshUser(); },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  });
  const setPrimary = useMutation({
    mutationFn: (orgNodeId: string) => api(`/access/users/${selectedUser}/primary-area`, { method: 'PATCH', json: { orgNodeId } }),
    onSuccess: () => { toast.success('Área principal definida.'); refreshUser(); },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Acesso"
        tone="admin"
        title="Matriz de Visibilidade entre Áreas"
        description="Defina o que cada área enxerga das outras e simule o acesso de cada usuário. Regras aplicadas no backend."
      />

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Níveis:</span>
        <Badge className="bg-muted text-muted-foreground border-transparent">Sem acesso</Badge>
        <Badge className="bg-blue-500/10 text-blue-600 border-transparent">Resumida</Badge>
        <Badge className="bg-emerald-500/10 text-emerald-600 border-transparent">Completa</Badge>
        <Badge className="bg-amber-500/10 text-amber-600 border-transparent">Edição</Badge>
        <Badge className="bg-rose-600/10 text-rose-700 border-transparent">Administrativa</Badge>
      </div>

      {/* Simular acesso */}
      <SectionCard title="Simular acesso de um usuário" description="Veja exatamente quais áreas o usuário enxerga e edita por módulo.">
        <div className="flex flex-wrap items-center gap-2">
          <Wand2 className="h-4 w-4 text-muted-foreground" />
          <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="h-9 min-w-[260px] rounded-md border border-border/60 bg-background px-2 text-sm">
            <option value="">Selecione um usuário...</option>
            {users.data?.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
          </select>
        </div>

        {selectedUser && simulation.data && (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="table-modern">
                <thead><tr><th className="text-left">Módulo</th><th className="text-left">Visualiza</th><th className="text-left">Edita</th></tr></thead>
                <tbody>
                  {simulation.data.perModule.map((m) => (
                    <tr key={m.module}>
                      <td className="font-medium">{m.module}</td>
                      <td className="text-xs"><span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{m.view}</span></td>
                      <td className="text-xs">{m.edit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-border/60 p-3 text-sm">
                <div className="mb-1 flex items-center gap-1.5 font-medium"><ShieldCheck className="h-4 w-4" /> Contexto</div>
                <div className="text-xs text-muted-foreground">Papel: <span className="font-mono">{simulation.data.context.role}</span></div>
                <div className="text-xs text-muted-foreground">{simulation.data.context.companyWide ? 'Acesso total à empresa (admin)' : `Restrição por área: ${simulation.data.context.areaAccessEnabled ? 'ligada' : 'desligada'}`}</div>
                <div className="text-xs text-muted-foreground">Área principal: {simulation.data.context.primaryArea ?? '—'}</div>
              </div>
              {/* Áreas do usuário */}
              <div className="rounded-lg border border-border/60 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-sm font-medium"><UserCog className="h-4 w-4" /> Áreas do usuário</div>
                <div className="space-y-1.5">
                  {userAreas.data?.assignments.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">{areaName.get(a.orgNodeId) ?? a.orgNodeId}{a.isPrimary && <Badge variant="secondary" className="ml-1 text-[9px]">principal</Badge>}</span>
                      <div className="flex shrink-0 gap-1">
                        {!a.isPrimary && <button className="text-muted-foreground hover:text-foreground" onClick={() => setPrimary.mutate(a.orgNodeId)} title="Tornar principal">★</button>}
                        {!a.isPrimary && <button className="text-rose-600" onClick={() => removeAssignment.mutate(a.orgNodeId)} title="Remover"><Trash2 className="h-3 w-3" /></button>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-1">
                  <select id="add-area" className="h-8 flex-1 rounded-md border border-border/60 bg-background px-2 text-xs"
                    onChange={(e) => { if (e.target.value) { addAssignment.mutate(e.target.value); e.target.value = ''; } }}>
                    <option value="">+ Adicionar área secundária...</option>
                    {areas.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Matriz */}
      <SectionCard
        title="Regras de visibilidade entre áreas"
        description="Origem enxerga Destino, por módulo. A ordem de prioridade (DENY > ALLOW > matriz > própria área) é aplicada no servidor."
        contentClassName="p-0"
      >
        <RuleForm areas={areas.data ?? []} modules={modules.data ?? []} onSaved={() => qc.invalidateQueries({ queryKey: ['access-matrix'] })} />
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead><tr><th className="text-left">Origem</th><th className="text-left">Destino</th><th className="text-left">Módulo</th><th className="text-left">Nível</th><th className="text-left">Permissões</th><th></th></tr></thead>
            <tbody>
              {matrix.data?.map((r) => (
                <tr key={r.id}>
                  <td className="text-sm">{r.sourceAreaName}</td>
                  <td className="text-sm">{r.targetAreaName}</td>
                  <td className="text-xs font-mono">{r.moduleKey}</td>
                  <td><Badge className={cn('text-[10px] border-transparent', LEVEL_COLOR[r.visibilityLevel])}>{r.visibilityLevel}</Badge></td>
                  <td className="text-[10px] text-muted-foreground">
                    {[r.canView && 'ver', r.canCreate && 'criar', r.canEdit && 'editar', r.canDelete && 'excluir', r.canApprove && 'aprovar', r.canExport && 'exportar'].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="text-right">
                    <button className="text-rose-600" onClick={() => deleteRule.mutate(r.id)} title="Remover regra"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
              {!matrix.isLoading && (matrix.data?.length ?? 0) === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Nenhuma regra. Por padrão, cada área vê apenas a si mesma.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function RuleForm({ areas, modules, onSaved }: { areas: Area[]; modules: string[]; onSaved: () => void }) {
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [moduleKey, setModuleKey] = useState('*');
  const [level, setLevel] = useState('SUMMARY');
  const [caps, setCaps] = useState({ canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canExport: false });

  const save = useMutation({
    mutationFn: () => api('/access/matrix', { method: 'POST', json: { sourceAreaId: source, targetAreaId: target, moduleKey, visibilityLevel: level, ...caps } }),
    onSuccess: () => { toast.success('Regra salva.'); setSource(''); setTarget(''); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao salvar regra'),
  });

  return (
    <div className="flex flex-wrap items-end gap-2 border-b border-border/60 bg-muted/20 p-3">
      <Sel label="Origem" value={source} onChange={setSource} options={areas.map((a) => ({ value: a.id, label: a.name }))} placeholder="Área de origem" />
      <Sel label="Destino" value={target} onChange={setTarget} options={areas.map((a) => ({ value: a.id, label: a.name }))} placeholder="Área de destino" />
      <Sel label="Módulo" value={moduleKey} onChange={setModuleKey} options={[{ value: '*', label: 'Todos' }, ...modules.map((m) => ({ value: m, label: m }))]} />
      <Sel label="Nível" value={level} onChange={setLevel} options={LEVELS.map((l) => ({ value: l, label: l }))} />
      <div className="flex flex-wrap items-center gap-2 pb-1 text-xs">
        {(['canView', 'canCreate', 'canEdit', 'canApprove', 'canExport'] as const).map((k) => (
          <label key={k} className="flex items-center gap-1">
            <input type="checkbox" checked={caps[k]} onChange={(e) => setCaps((c) => ({ ...c, [k]: e.target.checked }))} className="h-3.5 w-3.5 accent-foreground" />
            {k.replace('can', '').toLowerCase()}
          </label>
        ))}
      </div>
      <Button size="sm" className="h-9" disabled={!source || !target || save.isPending} onClick={() => save.mutate()}>
        <Plus className="mr-1 h-4 w-4" /> Adicionar regra
      </Button>
    </div>
  );
}

function Sel({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 min-w-[150px] rounded-md border border-border/60 bg-background px-2 text-sm">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
