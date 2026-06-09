'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ClipboardList, Save, Lock, Unlock } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

interface CompetenceRef { id: string; label: string; status: string; program: { code: string; name: string } }
interface PxrRow {
  indicatorId: string; code: string; name: string; unit: string | null; kind: string;
  target: number | null; zero: number | null; realized: number | null; actualStatus: string | null;
}
interface Pxr { competenceId: string; rows: PxrRow[] }

const ASTATUS: Record<string, { label: string; variant: any }> = {
  IN_FILLING: { label: 'Em preenchimento', variant: 'secondary' },
  PENDING: { label: 'Pendente', variant: 'default' },
  IN_VALIDATION: { label: 'Em validação', variant: 'default' },
  PRE_CLOSE: { label: 'Pré-fechamento', variant: 'default' },
  CLOSED: { label: 'Fechado', variant: 'outline' },
  REOPENED: { label: 'Reaberto', variant: 'destructive' },
  CORRECTED: { label: 'Corrigido', variant: 'default' },
};
const LOCKED_COMP = ['CLOSED_FOR_CALC', 'IN_CALCULATION', 'IN_REVIEW', 'IN_APPROVAL', 'APPROVED', 'SENT_TO_PAYROLL', 'PAYSLIPS_PUBLISHED', 'CLOSED'];

export default function PrizeActualsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['prize:actuals:manage']);
  const canClose = hasPermission(['prize:actuals:close']);

  const [competenceId, setCompetenceId] = useState('');
  const [draft, setDraft] = useState<Record<string, string>>({});

  const { data: competences = [] } = useQuery({ queryKey: ['prize-competences-ref'], queryFn: () => api<CompetenceRef[]>('/prize/competences') });
  const competence = competences.find((c) => c.id === competenceId);
  const locked = competence ? LOCKED_COMP.includes(competence.status) : false;

  const { data: pxr, isLoading } = useQuery({
    queryKey: ['prize-pxr', competenceId],
    queryFn: () => api<Pxr>(`/prize/actuals/previsto-realizado/${competenceId}`),
    enabled: !!competenceId,
  });

  useEffect(() => { setDraft({}); }, [competenceId]);

  const saveGrid = useMutation({
    mutationFn: () => {
      const rows = Object.entries(draft)
        .filter(([, v]) => v !== '')
        .map(([indicatorId, v]) => ({ indicatorId, realized: Number(v) }));
      if (rows.length === 0) throw new ApiError(400, 'Nada para salvar', null);
      return api(`/prize/actuals/competence/${competenceId}/grid`, { method: 'POST', json: { rows } });
    },
    onSuccess: (r: any) => { toast.success(`${r.saved} lançamento(s) salvo(s)`); setDraft({}); qc.invalidateQueries({ queryKey: ['prize-pxr'] }); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const closeActuals = useMutation({
    mutationFn: () => api(`/prize/actuals/competence/${competenceId}/close`, { method: 'POST' }),
    onSuccess: (r: any) => { toast.success(`Realizado fechado (${r.closed})`); qc.invalidateQueries({ queryKey: ['prize-pxr'] }); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const reopen = useMutation({
    mutationFn: ({ actualId, justification }: { actualId: string; justification: string }) => api(`/prize/actuals/${actualId}/reopen`, { method: 'POST', json: { justification } }),
    onSuccess: () => { toast.success('Realizado reaberto'); qc.invalidateQueries({ queryKey: ['prize-pxr'] }); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Lançamento do Realizado"
        eyebrow="Gestão de Prêmio"
        description="O Gestão 360 é a fonte oficial do realizado. Lance por indicador e competência, com validações e trava de fechamento."
        tone="view"
        breadcrumbs={[{ label: 'Gestão de Prêmio', href: '/gestao-premio' }, { label: 'Lançamento do Realizado' }]}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Label className="text-xs text-muted-foreground">Competência:</Label>
        <NativeSelect value={competenceId} onChange={(e) => setCompetenceId(e.target.value)} className="max-w-sm">
          <option value="">Selecione…</option>
          {competences.map((c) => <option key={c.id} value={c.id}>{c.program.code} — {c.label}</option>)}
        </NativeSelect>
        {competence && locked && <Badge variant="outline"><Lock className="mr-1 h-3 w-3" />Competência travada</Badge>}
        <div className="ml-auto flex gap-2">
          {canManage && competenceId && !locked && (
            <Button onClick={() => saveGrid.mutate()} disabled={saveGrid.isPending || Object.keys(draft).length === 0}>
              <Save className="mr-1 h-4 w-4" />Salvar lançamentos
            </Button>
          )}
          {canClose && competenceId && !locked && (
            <Button variant="outline" onClick={() => closeActuals.mutate()} disabled={closeActuals.isPending}>
              <Lock className="mr-1 h-4 w-4" />Fechar realizado
            </Button>
          )}
        </div>
      </div>

      {!competenceId ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <ClipboardList className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Selecione uma competência para lançar o realizado.</p>
        </CardContent></Card>
      ) : isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : !pxr?.rows.length ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum indicador no programa desta competência.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Indicador</th>
                  <th className="px-3 py-2 text-right">Zero</th>
                  <th className="px-3 py-2 text-right">Meta</th>
                  <th className="px-3 py-2 text-right">Realizado</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {pxr.rows.map((r) => {
                  const st = r.actualStatus ? ASTATUS[r.actualStatus] : null;
                  const rowLocked = r.actualStatus === 'CLOSED' || locked;
                  return (
                    <tr key={r.indicatorId} className="border-b border-border/40">
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.code}{r.unit ? ` · ${r.unit}` : ''}</div>
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{r.zero ?? '—'}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{r.target ?? '—'}</td>
                      <td className="px-3 py-2 text-right">
                        {canManage && !rowLocked ? (
                          <Input
                            type="number"
                            className="ml-auto h-8 w-28 text-right"
                            defaultValue={r.realized ?? ''}
                            value={draft[r.indicatorId] ?? (r.realized ?? '')}
                            onChange={(e) => setDraft({ ...draft, [r.indicatorId]: e.target.value })}
                          />
                        ) : (
                          <span className="font-medium">{r.realized ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{st ? <Badge variant={st.variant}>{st.label}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2 text-right">
                        {canClose && r.actualStatus === 'CLOSED' && (r as any).actualId && (
                          <Button size="sm" variant="ghost" onClick={() => {
                            const j = window.prompt('Justificativa para reabrir (obrigatória):');
                            if (j?.trim()) reopen.mutate({ actualId: (r as any).actualId, justification: j });
                          }}><Unlock className="h-3.5 w-3.5" /></Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
