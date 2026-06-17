'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Gauge } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api';
import type { CatalogIndicator } from './types';

interface CatalogActual {
  id: string;
  catalogId: string;
  realized: string | null;
  accumulated: string | null;
  status: string;
}

export function CatalogActualsSection({ competenceId, canManage }: { competenceId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const { data: catalog = [] } = useQuery({
    queryKey: ['prize-rule-catalog'],
    queryFn: () => api<CatalogIndicator[]>('/prize/rules/catalog'),
    enabled: open,
  });
  const { data: actuals = [] } = useQuery({
    queryKey: ['prize-catalog-actuals', competenceId],
    queryFn: () => api<CatalogActual[]>(`/prize/rules/competence/${competenceId}/catalog-actuals`),
    enabled: open && !!competenceId,
  });

  const byCatalog = useMemo(() => {
    const m = new Map<string, CatalogActual>();
    for (const a of actuals) m.set(a.catalogId, a);
    return m;
  }, [actuals]);

  const save = useMutation({
    mutationFn: (catalogId: string) => api(`/prize/rules/competence/${competenceId}/catalog-actuals`, {
      method: 'POST',
      json: { catalogId, realized: draft[catalogId]?.trim() === '' || draft[catalogId] == null ? null : Number(draft[catalogId]), status: 'PENDING' },
    }),
    onSuccess: () => { toast.success('Realizado salvo'); qc.invalidateQueries({ queryKey: ['prize-catalog-actuals', competenceId] }); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const valueOf = (catalogId: string) => draft[catalogId] ?? (byCatalog.get(catalogId)?.realized ?? '');
  const active = catalog.filter((c) => c.active);

  return (
    <Card>
      <CardContent className="p-0">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Gauge className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Realizado por indicador (entrada da régua v2)</span>
          <span className="text-xs text-muted-foreground">— lance o realizado do mês por indicador de catálogo; é o que a apuração v2 usa.</span>
        </button>
        {open && (
          <div className="overflow-x-auto border-t border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Indicador</th>
                  <th className="px-3 py-2 text-left">Nº BSC</th>
                  <th className="px-3 py-2 text-left">Realizado</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  {canManage && <th className="px-3 py-2 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {active.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Catálogo vazio. Vincule indicadores nas combinações dos anexos.</td></tr>}
                {active.map((c) => {
                  const a = byCatalog.get(c.id);
                  return (
                    <tr key={c.id} className="border-t border-border/40">
                      <td className="px-3 py-2">{c.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{c.bscNumber ?? '—'}</td>
                      <td className="px-3 py-2">
                        {canManage ? <Input type="number" className="h-7 w-28" value={valueOf(c.id)} onChange={(e) => setDraft((d) => ({ ...d, [c.id]: e.target.value }))} /> : (a?.realized ?? '—')}
                      </td>
                      <td className="px-3 py-2">{a ? <Badge variant="outline">{a.status}</Badge> : <span className="text-muted-foreground">não lançado</span>}</td>
                      {canManage && (
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="outline" className="h-7" onClick={() => save.mutate(c.id)} disabled={save.isPending}>Salvar</Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
