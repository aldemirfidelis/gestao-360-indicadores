'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Gauge, RefreshCw, Link2, PencilLine } from 'lucide-react';
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
  source?: string | null;
}

interface SyncSummary {
  linked: number;
  synced: number;
  unchanged: number;
  missingResult: Array<{ code: string; name: string }>;
  unlinked: Array<{ code: string; name: string }>;
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

  const sync = useMutation({
    mutationFn: () => api<SyncSummary>(`/prize/actuals/competence/${competenceId}/sync-catalog`, { method: 'POST' }),
    onSuccess: (r) => {
      const parts = [`${r.synced} atualizado(s)`, `${r.unchanged} sem mudança`];
      if (r.missingResult.length) parts.push(`${r.missingResult.length} sem lançamento no período`);
      if (r.unlinked.length) parts.push(`${r.unlinked.length} sem indicador nativo (manual)`);
      toast.success(`Realizado puxado da plataforma: ${parts.join(', ')}`);
      qc.invalidateQueries({ queryKey: ['prize-catalog-actuals', competenceId] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

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
  const linkedCount = active.filter((c) => c.platformIndicatorId).length;

  return (
    <Card>
      <CardContent className="p-0">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Gauge className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Realizado por indicador (régua v2)</span>
          <span className="text-xs text-muted-foreground">— puxa o realizado dos indicadores nativos; manual só para indicador sem fonte na plataforma.</span>
        </button>
        {open && (
          <div className="border-t border-border/60">
            {canManage && (
              <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-4 py-2">
                <Button size="sm" variant="outline" className="h-7" onClick={() => sync.mutate()} disabled={sync.isPending || !competenceId}>
                  <RefreshCw className={`mr-1 h-3.5 w-3.5 ${sync.isPending ? 'animate-spin' : ''}`} />Puxar da plataforma
                </Button>
                <span className="text-xs text-muted-foreground">
                  {linkedCount} de {active.length} indicador(es) vinculado(s) a indicador nativo — esses sincronizam automaticamente do módulo de Lançamentos.
                </span>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Indicador</th>
                    <th className="px-3 py-2 text-left">Nº BSC</th>
                    <th className="px-3 py-2 text-left">Origem</th>
                    <th className="px-3 py-2 text-left">Realizado</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    {canManage && <th className="px-3 py-2 text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {active.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Catálogo vazio. Vincule indicadores nas combinações dos anexos.</td></tr>}
                  {active.map((c) => {
                    const a = byCatalog.get(c.id);
                    const linked = !!c.platformIndicatorId;
                    return (
                      <tr key={c.id} className="border-t border-border/40">
                        <td className="px-3 py-2">{c.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{c.bscNumber ?? '—'}</td>
                        <td className="px-3 py-2">
                          {linked
                            ? <Badge variant="secondary" className="gap-1 text-[10px]"><Link2 className="h-3 w-3" />automático (plataforma)</Badge>
                            : <Badge variant="outline" className="gap-1 text-[10px]"><PencilLine className="h-3 w-3" />manual</Badge>}
                        </td>
                        <td className="px-3 py-2">
                          {linked
                            ? (a?.realized ?? <span className="text-muted-foreground">— sem lançamento no período</span>)
                            : (canManage ? <Input type="number" className="h-7 w-28" value={valueOf(c.id)} onChange={(e) => setDraft((d) => ({ ...d, [c.id]: e.target.value }))} /> : (a?.realized ?? '—'))}
                        </td>
                        <td className="px-3 py-2">{a ? <Badge variant="outline">{a.status}</Badge> : <span className="text-muted-foreground">não lançado</span>}</td>
                        {canManage && (
                          <td className="px-3 py-2 text-right">
                            {linked
                              ? <span className="text-xs text-muted-foreground">via Lançamentos</span>
                              : <Button size="sm" variant="outline" className="h-7" onClick={() => save.mutate(c.id)} disabled={save.isPending}>Salvar</Button>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
