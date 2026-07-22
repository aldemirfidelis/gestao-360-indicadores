'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronRight, Network, Pencil, Search, Users, X } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Emp {
  id: string;
  name: string;
  registrationId: string | null;
  superiorEmployeeId: string | null;
  jobName: string | null;
  areaName: string | null;
}

export default function HierarquiaPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['compensation:manage', 'org:positions:manage']);
  const [picker, setPicker] = useState<Emp | null>(null);

  const query = useQuery<Emp[]>({ queryKey: ['compensation', 'hierarquia'], queryFn: () => api('/cargos-salarios/hierarquia') });
  const employees = query.data ?? [];

  const setSuperior = useMutation({
    mutationFn: ({ employeeId, superiorEmployeeId }: { employeeId: string; superiorEmployeeId: string | null }) =>
      api(`/cargos-salarios/hierarquia/${employeeId}`, { method: 'PATCH', json: { superiorEmployeeId } }),
    onSuccess: () => {
      toast.success('Hierarquia atualizada');
      setPicker(null);
      void qc.invalidateQueries({ queryKey: ['compensation', 'hierarquia'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível atualizar a hierarquia'),
  });

  const { roots, childrenOf, byId } = useMemo(() => {
    const byId = new Map(employees.map((e) => [e.id, e]));
    const childrenOf = new Map<string | null, Emp[]>();
    for (const e of employees) {
      const key = e.superiorEmployeeId && byId.has(e.superiorEmployeeId) ? e.superiorEmployeeId : null;
      const list = childrenOf.get(key) ?? [];
      list.push(e);
      childrenOf.set(key, list);
    }
    const sortByName = (a: Emp, b: Emp) => a.name.localeCompare(b.name);
    for (const list of childrenOf.values()) list.sort(sortByName);
    return { roots: (childrenOf.get(null) ?? []).slice().sort(sortByName), childrenOf, byId };
  }, [employees]);

  // Descendentes de um colaborador (para excluir do seletor de superior e evitar ciclos).
  const descendantsOf = (id: string): Set<string> => {
    const out = new Set<string>();
    const stack = [...(childrenOf.get(id) ?? [])];
    while (stack.length) {
      const cur = stack.pop()!;
      if (out.has(cur.id)) continue;
      out.add(cur.id);
      stack.push(...(childrenOf.get(cur.id) ?? []));
    }
    return out;
  };

  function Node({ emp, depth }: { emp: Emp; depth: number }) {
    const kids = childrenOf.get(emp.id) ?? [];
    return (
      <div>
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm"
          style={{ marginLeft: depth * 22 }}
        >
          {depth > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          <span className="font-semibold text-foreground">{emp.name}</span>
          {emp.jobName && <Badge variant="outline" className="text-[10px]">{emp.jobName}</Badge>}
          {emp.areaName && <span className="text-xs text-muted-foreground">· {emp.areaName}</span>}
          {kids.length > 0 && <span className="text-[10px] text-muted-foreground">({kids.length} subordinado{kids.length > 1 ? 's' : ''})</span>}
          {canManage && (
            <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => setPicker(emp)}>
              <Pencil className="mr-1 h-3.5 w-3.5" />Superior
            </Button>
          )}
        </div>
        {kids.map((child) => <Node key={child.id} emp={child} depth={depth + 1} />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Hierarquia por cargo" description="Cadeia de comando: defina o superior imediato de cada colaborador (Superintendente → gerentes → gestores/coordenadores → colaboradores)." />

      <Card>
        <CardContent className="space-y-2 p-4">
          {query.isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Carregando hierarquia…</p>}
          {!query.isLoading && employees.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Users className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum colaborador ativo para montar a hierarquia.</p>
            </div>
          )}
          {roots.map((emp) => <Node key={emp.id} emp={emp} depth={0} />)}
          {!query.isLoading && employees.length > 0 && roots.length === employees.length && (
            <p className="pt-2 text-xs text-muted-foreground">Defina os superiores para desdobrar a árvore. Quem não tem superior aparece no topo.</p>
          )}
        </CardContent>
      </Card>

      <SuperiorPicker
        target={picker}
        candidates={employees}
        blockedIds={picker ? new Set([picker.id, ...descendantsOf(picker.id)]) : new Set()}
        currentSuperior={picker?.superiorEmployeeId ? byId.get(picker.superiorEmployeeId) ?? null : null}
        saving={setSuperior.isPending}
        onClose={() => setPicker(null)}
        onSelect={(superiorEmployeeId) => picker && setSuperior.mutate({ employeeId: picker.id, superiorEmployeeId })}
      />
    </div>
  );
}

function SuperiorPicker({
  target, candidates, blockedIds, currentSuperior, saving, onClose, onSelect,
}: {
  target: Emp | null;
  candidates: Emp[];
  blockedIds: Set<string>;
  currentSuperior: Emp | null;
  saving: boolean;
  onClose: () => void;
  onSelect: (superiorEmployeeId: string | null) => void;
}) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const list = candidates
    .filter((e) => !blockedIds.has(e.id) && (!q || e.name.toLowerCase().includes(q) || (e.jobName ?? '').toLowerCase().includes(q)))
    .slice(0, 40);

  return (
    <Dialog open={Boolean(target)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Network className="h-4 w-4" />Superior de {target?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Superior atual: <span className="font-medium text-foreground">{currentSuperior?.name ?? 'Nenhum (topo)'}</span></span>
            {currentSuperior && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-status-red" disabled={saving} onClick={() => onSelect(null)}>
                <X className="mr-1 h-3.5 w-3.5" />Remover
              </Button>
            )}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar por nome ou cargo…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
          </div>
          <div className="max-h-72 divide-y overflow-auto rounded-md border">
            {list.length === 0 && <div className="p-3 text-xs text-muted-foreground">Nenhum colaborador elegível encontrado.</div>}
            {list.map((e) => (
              <button
                key={e.id}
                type="button"
                disabled={saving}
                onClick={() => onSelect(e.id)}
                className={cn('flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60 disabled:opacity-50', e.id === currentSuperior?.id && 'bg-muted/40')}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{e.name}</span>
                  {(e.jobName || e.areaName) && <span className="block truncate text-xs text-muted-foreground">{[e.jobName, e.areaName].filter(Boolean).join(' · ')}</span>}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Os próprios subordinados do colaborador não aparecem (evita ciclo na hierarquia).</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
