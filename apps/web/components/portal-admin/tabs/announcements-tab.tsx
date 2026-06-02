'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Megaphone, Plus, Trash2 } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface Announcement { id: string; title: string; message: string; type: string; priority: number; display: string; pinned: boolean; active: boolean; startsAt: string | null; endsAt: string | null }
const TYPES = ['info', 'warning', 'maintenance', 'update', 'urgent', 'training', 'feature'];

export function AnnouncementsTab() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<Partial<Announcement> | null>(null);
  const list = useQuery<Announcement[]>({ queryKey: ['portal', 'announcements'], queryFn: () => api('/admin/portal/announcements'), refetchOnWindowFocus: false });
  const inv = () => { qc.invalidateQueries({ queryKey: ['portal', 'announcements'] }); qc.invalidateQueries({ queryKey: ['portal', 'config'] }); };
  const del = useMutation({ mutationFn: (id: string) => api(`/admin/portal/announcements/${id}`, { method: 'DELETE' }), onSuccess: inv });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Comunicados exibidos como banner/modal no portal, por público e período.</p>
        <Button size="sm" onClick={() => setDialog({ type: 'info', display: 'banner', active: true })}><Plus className="mr-2 h-4 w-4" />Novo aviso</Button>
      </div>
      <SectionCard title="Comunicados" description="" contentClassName="p-0">
        {list.isLoading && <LoadingState label="Lendo avisos..." />}
        {(list.data ?? []).length === 0 ? <div className="p-4 text-sm text-muted-foreground">Nenhum comunicado.</div> : (
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead><tr><th className="text-left">Título</th><th className="text-left">Tipo</th><th className="text-left">Exibição</th><th className="text-left">Período</th><th className="text-left">Ativo</th><th className="text-right">Ações</th></tr></thead>
              <tbody>{(list.data ?? []).map((a) => (
                <tr key={a.id}>
                  <td><div className="flex items-center gap-1.5 font-medium"><Megaphone className="h-3.5 w-3.5 text-muted-foreground" />{a.title}</div></td>
                  <td><Badge variant="outline">{a.type}</Badge></td>
                  <td className="text-xs">{a.display}{a.pinned ? ' · fixo' : ''}</td>
                  <td className="text-xs">{a.startsAt ? formatDate(a.startsAt) : '—'} → {a.endsAt ? formatDate(a.endsAt) : '—'}</td>
                  <td>{a.active ? 'Sim' : 'Não'}</td>
                  <td className="text-right"><div className="flex justify-end gap-1"><Button variant="outline" size="sm" onClick={() => setDialog(a)}>Editar</Button><Button variant="ghost" size="sm" className="text-destructive" onClick={() => del.mutate(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </SectionCard>
      {dialog && <AnnDialog a={dialog} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); inv(); }} />}
    </div>
  );
}

function AnnDialog({ a, onClose, onSaved }: { a: Partial<Announcement>; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ title: a.title ?? '', message: a.message ?? '', type: a.type ?? 'info', priority: String(a.priority ?? 0), display: a.display ?? 'banner', pinned: a.pinned ?? false, active: a.active !== false, startsAt: a.startsAt?.slice(0, 16) ?? '', endsAt: a.endsAt?.slice(0, 16) ?? '' });
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, priority: Number(form.priority), startsAt: form.startsAt || null, endsAt: form.endsAt || null };
      return a.id ? api(`/admin/portal/announcements/${a.id}`, { method: 'PUT', json: body }) : api('/admin/portal/announcements', { method: 'POST', json: body });
    },
    onSuccess: () => { toast.success('Comunicado salvo.'); onSaved(); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{a.id ? 'Editar aviso' : 'Novo aviso'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Mensagem</Label><Textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
          <div><Label>Tipo</Label><NativeSelect value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</NativeSelect></div>
          <div><Label>Exibição</Label><NativeSelect value={form.display} onChange={(e) => setForm({ ...form, display: e.target.value })}><option value="banner">Banner</option><option value="modal">Modal</option></NativeSelect></div>
          <div><Label>Prioridade</Label><Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} /></div>
          <div className="flex items-end gap-3 pb-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />Fixo</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Ativo</label></div>
          <div><Label>Início</Label><Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></div>
          <div><Label>Fim</Label><Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={!form.title || !form.message || save.isPending} onClick={() => save.mutate()}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
