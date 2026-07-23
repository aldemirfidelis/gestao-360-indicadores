'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, UserCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { LoadingState } from '@/components/platform/loading-state';
import { api } from '@/lib/api';

interface Recruiter {
  id: string; userId: string; userName: string | null; areaName: string | null;
  leadUserId: string | null; leadUserName: string | null; active: boolean;
}
interface Candidate { id: string; name: string; email: string; areaName: string | null; fromRh: boolean; alreadyRecruiter: boolean }

/**
 * Cadastro de recrutadores (quem conduz as seleções). Sugere usuários da área
 * de RH primeiro, mas aceita qualquer usuário ativo. Cada recrutador tem um
 * líder opcional que acompanha as vagas conduzidas por ele.
 */
export function RecruitersDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState('');
  const [leadUserId, setLeadUserId] = useState('');

  const recruitersQuery = useQuery<Recruiter[]>({ queryKey: ['recruit-recruiters'], queryFn: () => api('/recruitment/recruiters'), enabled: open });
  const candidatesQuery = useQuery<Candidate[]>({ queryKey: ['recruit-recruiter-candidates'], queryFn: () => api('/recruitment/recruiters/candidates'), enabled: open });

  const candidates = useMemo(() => candidatesQuery.data ?? [], [candidatesQuery.data]);
  // Líder pode ser qualquer usuário ativo (a lista de candidatos já são todos os ativos).
  const leadOptions = useMemo(() => candidates.filter((c) => c.id !== userId), [candidates, userId]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['recruit-recruiters'] });
    void qc.invalidateQueries({ queryKey: ['recruit-recruiter-candidates'] });
  };

  const create = useMutation({
    mutationFn: () => api('/recruitment/recruiters', { method: 'POST', json: { userId, leadUserId: leadUserId || null } }),
    onSuccess: () => { toast.success('Recrutador cadastrado.'); setUserId(''); setLeadUserId(''); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível cadastrar o recrutador.'),
  });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api(`/recruitment/recruiters/${id}`, { method: 'PATCH', json: { active } }),
    onSuccess: () => { invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível atualizar.'),
  });
  const setLead = useMutation({
    mutationFn: ({ id, leadUserId }: { id: string; leadUserId: string }) => api(`/recruitment/recruiters/${id}`, { method: 'PATCH', json: { leadUserId: leadUserId || null } }),
    onSuccess: () => { toast.success('Líder atualizado.'); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível atualizar o líder.'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/recruitment/recruiters/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Recrutador removido.'); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível remover.'),
  });

  const recruiters = recruitersQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-primary" /> Recrutadores</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Cadastre quem conduz as seleções. Os usuários da área de Recursos Humanos aparecem primeiro. Defina um líder
            para cada recrutador — ele acompanha automaticamente as vagas conduzidas por esse recrutador.
          </p>

          {/* Cadastro */}
          <div className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <Label className="text-xs">Recrutador</Label>
              <NativeSelect value={userId} onChange={(e) => setUserId(e.target.value)} className="h-9 text-xs">
                <option value="">Selecione o usuário…</option>
                {candidates.filter((c) => !c.alreadyRecruiter).map((c) => (
                  <option key={c.id} value={c.id}>{c.fromRh ? '★ ' : ''}{c.name}{c.areaName ? ` — ${c.areaName}` : ''}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label className="text-xs">Líder (acompanha) — opcional</Label>
              <NativeSelect value={leadUserId} onChange={(e) => setLeadUserId(e.target.value)} className="h-9 text-xs">
                <option value="">Sem líder</option>
                {leadOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </NativeSelect>
            </div>
            <Button size="sm" disabled={!userId || create.isPending} onClick={() => create.mutate()}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Cadastrar
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">★ indica usuários da área de Recursos Humanos.</p>

          {/* Lista */}
          {recruitersQuery.isLoading ? (
            <LoadingState label="Carregando recrutadores..." />
          ) : recruiters.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum recrutador cadastrado ainda.
            </div>
          ) : (
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {recruiters.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2.5 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{r.userName ?? '—'}</span>
                      {r.areaName && <span className="text-[10px] text-muted-foreground">{r.areaName}</span>}
                      {!r.active && <Badge variant="outline" className="text-[9px] text-muted-foreground">inativo</Badge>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      Líder:
                      <NativeSelect
                        className="h-7 w-44 text-[11px]"
                        value={r.leadUserId ?? ''}
                        onChange={(e) => setLead.mutate({ id: r.id, leadUserId: e.target.value })}
                      >
                        <option value="">Sem líder</option>
                        {candidates.filter((c) => c.id !== r.userId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </NativeSelect>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={toggle.isPending} onClick={() => toggle.mutate({ id: r.id, active: !r.active })}>
                    {r.active ? 'Desativar' : 'Ativar'}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-status-red" disabled={remove.isPending} onClick={() => remove.mutate(r.id)} title="Remover">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
