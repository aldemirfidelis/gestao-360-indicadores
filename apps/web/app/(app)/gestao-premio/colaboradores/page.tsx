'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { UserCheck, Download, AlertTriangle, Lock } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

interface CompetenceRef { id: string; label: string; program: { code: string; name: string } }
interface Employee {
  id: string; registration: string; name: string; cpfMasked: string | null; positionRef: string | null;
  areaRef: string | null; costCenterRef: string | null; situation: string; workedDays: number | null;
  eligible: boolean; blocked: boolean; lotVersion: number; events: number; baseSalary: number | null;
}
interface Snapshot { canSeeSalary: boolean; total: number; employees: Employee[] }
interface Recon {
  job: { lotVersion: number; processed: number; createdAt: string } | null;
  reconciliation: { added: string[]; removed: string[]; changed: any[]; unchanged: number; flags: { missingSalary: string[]; missingPosition: string[]; terminated: string[] } } | null;
}

export default function PrizeEligiblePage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['prize:eligible:manage']);

  const [competenceId, setCompetenceId] = useState('');
  const { data: competences = [] } = useQuery({ queryKey: ['prize-competences-ref'], queryFn: () => api<CompetenceRef[]>('/prize/competences') });
  const { data: snapshot, isLoading } = useQuery({
    queryKey: ['prize-eligible', competenceId],
    queryFn: () => api<Snapshot>(`/prize/eligible/competence/${competenceId}`),
    enabled: !!competenceId,
  });
  const { data: recon } = useQuery({
    queryKey: ['prize-eligible-recon', competenceId],
    queryFn: () => api<Recon>(`/prize/eligible/competence/${competenceId}/reconciliation`),
    enabled: !!competenceId,
  });

  const importMock = useMutation({
    mutationFn: () => api(`/prize/eligible/competence/${competenceId}/import`, { method: 'POST', json: { source: 'MANUAL', useMock: true, mockCount: 12 } }),
    onSuccess: (r: any) => {
      const rc = r.reconciliation;
      toast.success(`Lote ${r.job.lotVersion} importado: ${r.job.processed} colaborador(es) · +${rc.added.length}/-${rc.removed.length}/~${rc.changed.length}`);
      qc.invalidateQueries({ queryKey: ['prize-eligible'] });
      qc.invalidateQueries({ queryKey: ['prize-eligible-recon'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const r = recon?.reconciliation;

  return (
    <div>
      <PageHeader
        title="Colaboradores Elegíveis"
        eyebrow="Gestão de Prêmio"
        description="Base elegível por competência (Apdata). Snapshot imutável por lote, CPF mascarado e conciliação de divergências."
        tone="view"
        breadcrumbs={[{ label: 'Gestão de Prêmio', href: '/gestao-premio' }, { label: 'Colaboradores Elegíveis' }]}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Label className="text-xs text-muted-foreground">Competência:</Label>
        <NativeSelect value={competenceId} onChange={(e) => setCompetenceId(e.target.value)} className="max-w-sm">
          <option value="">Selecione…</option>
          {competences.map((c) => <option key={c.id} value={c.id}>{c.program.code} — {c.label}</option>)}
        </NativeSelect>
        {canManage && competenceId && (
          <Button className="ml-auto" variant="outline" onClick={() => importMock.mutate()} disabled={importMock.isPending}>
            <Download className="mr-1 h-4 w-4" />{importMock.isPending ? 'Importando…' : 'Importar base fictícia (homologação)'}
          </Button>
        )}
      </div>

      {!competenceId ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <UserCheck className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Selecione uma competência para ver/importar a base elegível.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {r && (
            <Card>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium"><AlertTriangle className="h-4 w-4 text-amber-600" />Conciliação do último lote {recon?.job?.lotVersion ? `(v${recon.job.lotVersion})` : ''}</div>
                <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4 lg:grid-cols-7">
                  <Badge variant="secondary">+{r.added.length} novos</Badge>
                  <Badge variant="secondary">−{r.removed.length} saíram</Badge>
                  <Badge variant="secondary">~{r.changed.length} alterados</Badge>
                  <Badge variant="outline">{r.unchanged} iguais</Badge>
                  <Badge variant="outline">{r.flags.missingSalary.length} sem salário</Badge>
                  <Badge variant="outline">{r.flags.missingPosition.length} sem cargo</Badge>
                  <Badge variant="outline">{r.flags.terminated.length} desligados</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : !snapshot?.employees.length ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhuma base importada para esta competência ainda.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
                  <span>{snapshot.total} colaborador(es) · lote corrente</span>
                  {!snapshot.canSeeSalary && <span className="flex items-center gap-1"><Lock className="h-3 w-3" />Salário oculto (requer permissão)</span>}
                </div>
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Matrícula</th>
                      <th className="px-3 py-2 text-left">Nome</th>
                      <th className="px-3 py-2 text-left">CPF</th>
                      <th className="px-3 py-2 text-left">Cargo</th>
                      <th className="px-3 py-2 text-left">Área</th>
                      <th className="px-3 py-2 text-left">CC</th>
                      <th className="px-3 py-2 text-right">Salário</th>
                      <th className="px-3 py-2 text-left">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.employees.map((e) => (
                      <tr key={e.id} className={`border-b border-border/40 ${e.blocked ? 'bg-red-50/40' : ''}`}>
                        <td className="px-3 py-2 font-mono text-xs">{e.registration}</td>
                        <td className="px-3 py-2">{e.name}{e.events > 0 && <span className="ml-1 text-xs text-muted-foreground">({e.events} ev.)</span>}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{e.cpfMasked ?? '—'}</td>
                        <td className="px-3 py-2">{e.positionRef ?? <span className="text-amber-600">—</span>}</td>
                        <td className="px-3 py-2">{e.areaRef ?? '—'}</td>
                        <td className="px-3 py-2">{e.costCenterRef ?? '—'}</td>
                        <td className="px-3 py-2 text-right">{e.baseSalary !== null ? e.baseSalary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : (snapshot.canSeeSalary ? '—' : '•••')}</td>
                        <td className="px-3 py-2">
                          {e.situation?.toUpperCase().startsWith('TERMIN')
                            ? <Badge variant="destructive">Desligado</Badge>
                            : <Badge variant="secondary">{e.situation}</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
