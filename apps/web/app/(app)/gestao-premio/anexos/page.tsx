'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Plus, FileSignature, GitBranch, Send, CheckCircle2, RotateCcw, Upload, Target } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

interface AnnexVersion {
  id: string; version: number; status: string; effectiveFrom: string | null; effectiveTo: string | null;
  salaryPercent: string | null; gainPotential: string | null; gainChance: string | null; changeReason: string | null;
  approvals?: Array<{ id: string; status: string; comment: string | null }>;
  _count?: { indicators: number };
}
interface AnnexDetail {
  id: string; code: string; name: string; orgNodeId: string | null; positionRef: string | null; costCenterRef: string | null;
  program: { id: string; code: string; name: string }; versions: AnnexVersion[];
}
interface AnnexListItem extends AnnexDetail { effectiveVersion: AnnexVersion | null; latestVersion: AnnexVersion | null }

const VSTATUS: Record<string, { label: string; variant: any }> = {
  DRAFT: { label: 'Rascunho', variant: 'secondary' },
  IN_ELABORATION: { label: 'Em elaboração', variant: 'secondary' },
  IN_VALIDATION: { label: 'Em validação', variant: 'default' },
  IN_APPROVAL: { label: 'Em aprovação', variant: 'default' },
  APPROVED: { label: 'Aprovado', variant: 'default' },
  EFFECTIVE: { label: 'Vigente', variant: 'default' },
  SUPERSEDED: { label: 'Substituído', variant: 'outline' },
  ARCHIVED: { label: 'Arquivado', variant: 'outline' },
};
const EDITABLE = ['DRAFT', 'IN_ELABORATION'];

export default function PrizeAnnexesPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['prize:annex:manage']);
  const canSubmit = hasPermission(['prize:annex:submit']);
  const canApprove = hasPermission(['prize:annex:approve']);

  const [programFilter, setProgramFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [editVersion, setEditVersion] = useState<AnnexVersion | null>(null);
  const [annexForm, setAnnexForm] = useState({ programId: '', code: '', name: '', orgNodeId: '', positionRef: '', costCenterRef: '', notes: '' });
  const [vForm, setVForm] = useState({ salaryPercent: '', gainPotential: '', gainChance: '', effectiveFrom: '', effectiveTo: '', changeReason: '' });

  const { data: programs = [] } = useQuery({ queryKey: ['prize-programs-ref'], queryFn: () => api<any[]>('/prize/programs') });
  const { data: annexes = [], isLoading } = useQuery({
    queryKey: ['prize-annexes', programFilter],
    queryFn: () => api<AnnexListItem[]>(`/prize/annexes${programFilter ? `?programId=${programFilter}` : ''}`),
  });
  const { data: detail } = useQuery({
    queryKey: ['prize-annex', selected],
    queryFn: () => api<AnnexDetail>(`/prize/annexes/${selected}`),
    enabled: !!selected,
  });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['prize-annexes'] }); qc.invalidateQueries({ queryKey: ['prize-annex'] }); };
  const onErr = (e: ApiError) => toast.error(e.message);

  const createAnnex = useMutation({
    mutationFn: () => api('/prize/annexes', { method: 'POST', json: annexForm }),
    onSuccess: () => { toast.success('Anexo criado'); invalidate(); setCreateOpen(false); },
    onError: onErr,
  });
  const newVersion = useMutation({
    mutationFn: (annexId: string) => api(`/prize/annexes/${annexId}/versions`, { method: 'POST', json: {} }),
    onSuccess: () => { toast.success('Nova versão criada'); invalidate(); }, onError: onErr,
  });
  const saveVersion = useMutation({
    mutationFn: () => api(`/prize/annexes/versions/${editVersion!.id}`, { method: 'PATCH', json: {
      salaryPercent: vForm.salaryPercent ? Number(vForm.salaryPercent) : null,
      gainPotential: vForm.gainPotential ? Number(vForm.gainPotential) : null,
      gainChance: vForm.gainChance ? Number(vForm.gainChance) : null,
      effectiveFrom: vForm.effectiveFrom || null, effectiveTo: vForm.effectiveTo || null, changeReason: vForm.changeReason || null,
    } }),
    onSuccess: () => { toast.success('Versão atualizada'); invalidate(); setEditVersion(null); }, onError: onErr,
  });
  const act = useMutation({
    mutationFn: ({ path, json }: { path: string; json?: any }) => api(path, { method: 'POST', json: json ?? {} }),
    onSuccess: () => { toast.success('Ação realizada'); invalidate(); }, onError: onErr,
  });

  function openCreate() {
    setAnnexForm({ programId: programFilter || programs[0]?.id || '', code: '', name: '', orgNodeId: '', positionRef: '', costCenterRef: '', notes: '' });
    setCreateOpen(true);
  }
  function openEditVersion(v: AnnexVersion) {
    setVForm({
      salaryPercent: v.salaryPercent ?? '', gainPotential: v.gainPotential ?? '', gainChance: v.gainChance ?? '',
      effectiveFrom: v.effectiveFrom ? v.effectiveFrom.slice(0, 10) : '', effectiveTo: v.effectiveTo ? v.effectiveTo.slice(0, 10) : '', changeReason: v.changeReason ?? '',
    });
    setEditVersion(v);
  }
  function decide(versionId: string, decision: 'APPROVE' | 'REJECT' | 'RETURN') {
    let comment: string | undefined;
    if (decision !== 'APPROVE') { comment = window.prompt(`Comentário (obrigatório) para ${decision === 'REJECT' ? 'reprovar' : 'devolver'}:`) ?? undefined; if (!comment?.trim()) return; }
    act.mutate({ path: `/prize/annexes/versions/${versionId}/decide`, json: { decision, comment } });
  }

  return (
    <div>
      <PageHeader
        title="Anexos e Regras"
        eyebrow="Gestão de Prêmio"
        description="Governança dos anexos: versões, vigência única, fluxo de trabalho de aprovação e trilha de auditoria."
        tone="view"
        breadcrumbs={[{ label: 'Gestão de Prêmio', href: '/gestao-premio' }, { label: 'Anexos e Regras' }]}
        actions={canManage ? <Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" />Novo anexo</Button> : undefined}
      />

      <div className="mb-4 flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Programa:</Label>
        <NativeSelect value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="max-w-xs">
          <option value="">Todos</option>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </NativeSelect>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : annexes.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <FileSignature className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Nenhum anexo cadastrado.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {annexes.map((a) => {
            const isOpen = selected === a.id;
            const eff = a.effectiveVersion;
            const latest = a.latestVersion;
            return (
              <Card key={a.id}>
                <CardContent className="p-4">
                  <div className="flex cursor-pointer items-center justify-between gap-3" onClick={() => setSelected(isOpen ? null : a.id)}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{a.code}</span>
                        <span className="font-medium">{a.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{a.program.code} — {a.program.name}{a.positionRef ? ` · ${a.positionRef}` : ''}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {eff ? <Badge variant="default">Vigente v{eff.version}</Badge> : <Badge variant="secondary">Sem versão vigente</Badge>}
                      {latest && latest.status !== 'EFFECTIVE' && <Badge variant="outline">{VSTATUS[latest.status]?.label} v{latest.version}</Badge>}
                    </div>
                  </div>

                  {isOpen && detail && (
                    <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">Versões</h4>
                        <div className="flex gap-2">
                          <Link href={`/gestao-premio/indicadores?programId=${a.program.id}`}>
                            <Button size="sm" variant="ghost"><Target className="mr-1 h-3.5 w-3.5" />Indicadores e faixas</Button>
                          </Link>
                          {canManage && <Button size="sm" variant="outline" onClick={() => newVersion.mutate(a.id)}><GitBranch className="mr-1 h-3.5 w-3.5" />Nova versão</Button>}
                        </div>
                      </div>
                      {detail.versions.map((v) => (
                        <div key={v.id} className="rounded-md border border-border/60 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">v{v.version}</span>
                              <Badge variant={VSTATUS[v.status]?.variant}>{VSTATUS[v.status]?.label ?? v.status}</Badge>
                              {v._count && <span className="text-xs text-muted-foreground">{v._count.indicators} indicador(es)</span>}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>% salário: {v.salaryPercent ?? '—'}</span>
                            <span>Potencial: {v.gainPotential ?? '—'}</span>
                            <span>Chance: {v.gainChance ?? '—'}</span>
                            <span>Vigência: {v.effectiveFrom?.slice(0, 10) ?? '—'} → {v.effectiveTo?.slice(0, 10) ?? 'aberta'}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {canManage && EDITABLE.includes(v.status) && <Button size="sm" variant="outline" onClick={() => openEditVersion(v)}>Editar</Button>}
                            {canSubmit && EDITABLE.includes(v.status) && <Button size="sm" variant="ghost" onClick={() => act.mutate({ path: `/prize/annexes/versions/${v.id}/submit` })}><Send className="mr-1 h-3.5 w-3.5" />Enviar p/ validação</Button>}
                            {canSubmit && v.status === 'IN_VALIDATION' && <Button size="sm" variant="ghost" onClick={() => act.mutate({ path: `/prize/annexes/versions/${v.id}/send-approval` })}>Enviar p/ aprovação</Button>}
                            {canApprove && (v.status === 'IN_APPROVAL' || v.status === 'IN_VALIDATION') && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => decide(v.id, 'APPROVE')}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Aprovar</Button>
                                <Button size="sm" variant="ghost" onClick={() => decide(v.id, 'RETURN')}><RotateCcw className="mr-1 h-3.5 w-3.5" />Devolver</Button>
                                <Button size="sm" variant="ghost" onClick={() => decide(v.id, 'REJECT')}>Reprovar</Button>
                              </>
                            )}
                            {canApprove && v.status === 'APPROVED' && <Button size="sm" onClick={() => act.mutate({ path: `/prize/annexes/versions/${v.id}/publish` })}><Upload className="mr-1 h-3.5 w-3.5" />Publicar (vigente)</Button>}
                          </div>
                          {v.approvals && v.approvals.length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              {v.approvals.map((ap) => <div key={ap.id}>Aprovação: {ap.status}{ap.comment ? ` — "${ap.comment}"` : ''}</div>)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create annex dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo anexo do prêmio</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Programa *</Label>
              <NativeSelect value={annexForm.programId} onChange={(e) => setAnnexForm({ ...annexForm, programId: e.target.value })}>
                <option value="">Selecione…</option>
                {programs.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </NativeSelect>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Código</Label><Input value={annexForm.code} onChange={(e) => setAnnexForm({ ...annexForm, code: e.target.value })} placeholder="auto (ANX-001)" /></div>
              <div><Label>Cargo (ref.)</Label><Input value={annexForm.positionRef} onChange={(e) => setAnnexForm({ ...annexForm, positionRef: e.target.value })} placeholder="Ex.: Operador II" /></div>
            </div>
            <div><Label>Nome *</Label><Input value={annexForm.name} onChange={(e) => setAnnexForm({ ...annexForm, name: e.target.value })} placeholder="Ex.: Anexo Operação — Operador" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Centro de custo (ref.)</Label><Input value={annexForm.costCenterRef} onChange={(e) => setAnnexForm({ ...annexForm, costCenterRef: e.target.value })} /></div>
              <div><Label>Área (orgNodeId)</Label><Input value={annexForm.orgNodeId} onChange={(e) => setAnnexForm({ ...annexForm, orgNodeId: e.target.value })} placeholder="opcional" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={() => createAnnex.mutate()} disabled={createAnnex.isPending || !annexForm.programId || !annexForm.name.trim()}>{createAnnex.isPending ? 'Criando…' : 'Criar anexo'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit version dialog */}
      <Dialog open={!!editVersion} onOpenChange={(o) => !o && setEditVersion(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar versão v{editVersion?.version}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div><Label>% salário</Label><Input type="number" value={vForm.salaryPercent} onChange={(e) => setVForm({ ...vForm, salaryPercent: e.target.value })} /></div>
              <div><Label>Potencial (R$)</Label><Input type="number" value={vForm.gainPotential} onChange={(e) => setVForm({ ...vForm, gainPotential: e.target.value })} /></div>
              <div><Label>Chance (%)</Label><Input type="number" value={vForm.gainChance} onChange={(e) => setVForm({ ...vForm, gainChance: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vigência início</Label><Input type="date" value={vForm.effectiveFrom} onChange={(e) => setVForm({ ...vForm, effectiveFrom: e.target.value })} /></div>
              <div><Label>Vigência fim</Label><Input type="date" value={vForm.effectiveTo} onChange={(e) => setVForm({ ...vForm, effectiveTo: e.target.value })} /></div>
            </div>
            <div><Label>Motivo da alteração</Label><Textarea rows={2} value={vForm.changeReason} onChange={(e) => setVForm({ ...vForm, changeReason: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditVersion(null)}>Cancelar</Button>
            <Button onClick={() => saveVersion.mutate()} disabled={saveVersion.isPending}>{saveVersion.isPending ? 'Salvando…' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
