'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { SlidersHorizontal, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

interface Moderator {
  id: string; name: string; eventType: string; criterion: string | null; reductionPercent: string | null;
  reductionValue: string | null; cap: string | null; cumulative: boolean; priority: number; active: boolean;
}

const EVENT_TYPES = ['FALTA', 'ATESTADO', 'MEDIDA_DISCIPLINAR', 'SUSPENSAO', 'ACIDENTE'];
const EVENT_LABEL: Record<string, string> = { FALTA: 'Falta', ATESTADO: 'Atestado', MEDIDA_DISCIPLINAR: 'Medida disciplinar', SUSPENSAO: 'Suspensão', ACIDENTE: 'Acidente (ato inseguro)' };
const CRITERIA: Record<string, string> = { ANY: 'Por ocorrência', PER_DAY: 'Por dia', PER_OCCURRENCE: 'Por evento' };

const emptyForm = { name: '', eventType: 'FALTA', criterion: 'PER_DAY', reductionPercent: '', reductionValue: '', cap: '', cumulative: true, priority: 0, active: true };

export default function PrizeModeratorsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canAdmin = hasPermission(['prize:admin']);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Moderator | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: rules = [], isLoading } = useQuery({ queryKey: ['prize-moderators'], queryFn: () => api<Moderator[]>('/prize/calc/moderators') });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name, eventType: form.eventType, criterion: form.criterion,
        reductionPercent: form.reductionPercent ? Number(form.reductionPercent) : null,
        reductionValue: form.reductionValue ? Number(form.reductionValue) : null,
        cap: form.cap ? Number(form.cap) : null, cumulative: form.cumulative, priority: Number(form.priority) || 0, active: form.active,
      };
      return editing ? api(`/prize/calc/moderators/${editing.id}`, { method: 'PATCH', json: payload }) : api('/prize/calc/moderators', { method: 'POST', json: payload });
    },
    onSuccess: () => { toast.success(editing ? 'Regra atualizada' : 'Regra criada'); qc.invalidateQueries({ queryKey: ['prize-moderators'] }); setOpen(false); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/prize/calc/moderators/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Regra removida'); qc.invalidateQueries({ queryKey: ['prize-moderators'] }); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  function openCreate() { setEditing(null); setForm(emptyForm); setOpen(true); }
  function openEdit(m: Moderator) {
    setEditing(m);
    setForm({ name: m.name, eventType: m.eventType, criterion: m.criterion ?? 'PER_DAY', reductionPercent: m.reductionPercent ?? '', reductionValue: m.reductionValue ?? '', cap: m.cap ?? '', cumulative: m.cumulative, priority: m.priority, active: m.active });
    setOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Moderadores (perdas individuais)"
        eyebrow="Gestão de Prêmio"
        description="Regras parametrizáveis de redução por evento (faltas, atestados, medida disciplinar, acidente). Aplicadas pelo motor após o resultado-base."
        tone="view"
        breadcrumbs={[{ label: 'Gestão de Prêmio', href: '/gestao-premio' }, { label: 'Moderadores' }]}
        actions={canAdmin ? <Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" />Nova regra</Button> : undefined}
      />

      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : rules.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <SlidersHorizontal className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Nenhuma regra de moderador. Sem regras, o motor não aplica reduções.</p>
          {canAdmin && <Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" />Criar primeira regra</Button>}
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Regra</th>
                  <th className="px-3 py-2 text-left">Evento</th>
                  <th className="px-3 py-2 text-left">Critério</th>
                  <th className="px-3 py-2 text-right">Redução</th>
                  <th className="px-3 py-2 text-right">Teto</th>
                  <th className="px-3 py-2 text-left">Cumul.</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((m) => (
                  <tr key={m.id} className="border-b border-border/40">
                    <td className="px-3 py-2 font-medium">{m.name}{!m.active && <Badge variant="outline" className="ml-2">inativa</Badge>}</td>
                    <td className="px-3 py-2">{EVENT_LABEL[m.eventType] ?? m.eventType}</td>
                    <td className="px-3 py-2 text-muted-foreground">{CRITERIA[m.criterion ?? 'ANY'] ?? m.criterion}</td>
                    <td className="px-3 py-2 text-right">{m.reductionPercent ? `${m.reductionPercent}%` : m.reductionValue ? `R$ ${m.reductionValue}` : '—'}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{m.cap ? `${m.cap}%` : '—'}</td>
                    <td className="px-3 py-2">{m.cumulative ? 'Sim' : 'Não'}</td>
                    <td className="px-3 py-2 text-right">
                      {canAdmin && <>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>Editar</Button>
                        <Button size="sm" variant="ghost" onClick={() => remove.mutate(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar regra' : 'Nova regra de moderador'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Falta injustificada" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Evento</Label>
                <NativeSelect value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })}>
                  {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_LABEL[t]}</option>)}
                </NativeSelect>
              </div>
              <div><Label>Critério</Label>
                <NativeSelect value={form.criterion} onChange={(e) => setForm({ ...form, criterion: e.target.value })}>
                  {Object.entries(CRITERIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </NativeSelect>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Redução (%)</Label><Input type="number" value={form.reductionPercent} onChange={(e) => setForm({ ...form, reductionPercent: e.target.value })} /></div>
              <div><Label>Redução (R$)</Label><Input type="number" value={form.reductionValue} onChange={(e) => setForm({ ...form, reductionValue: e.target.value })} /></div>
              <div><Label>Teto (%)</Label><Input type="number" value={form.cap} onChange={(e) => setForm({ ...form, cap: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prioridade</Label><Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} /></div>
              <label className="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.cumulative} onChange={(e) => setForm({ ...form, cumulative: e.target.checked })} />Cumulativa</label>
            </div>
            <p className="text-xs text-muted-foreground">Informe % OU valor fixo. O motor aplica a regra para cada evento do colaborador na competência.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>{save.isPending ? 'Salvando…' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
