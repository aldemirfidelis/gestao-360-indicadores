'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ExternalLink, Pause, Send } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';

interface Posting {
  id: string; slug: string; title: string; status: string; visibility: string; pcd: boolean;
  city: string | null; workMode: string | null; contractType: string | null;
  publicDescription: string | null; publicRequirements: string | null; benefitsText: string | null;
  processStepsText: string | null; showSalary: boolean; salaryText: string | null; closesAt: string | null;
  pipelineTemplateId: string | null; pipelineTemplate?: { name: string } | null;
}
interface Pipeline { id: string; name: string; isDefault: boolean }

const STATUS_TONE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700', PUBLISHED: 'bg-emerald-100 text-emerald-800', PAUSED: 'bg-amber-100 text-amber-800', CLOSED: 'bg-slate-100 text-slate-500',
};

export default function VacanciesPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['recruit:manage']);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Posting>>({});

  const listQuery = useQuery<Posting[]>({ queryKey: ['recruit-postings'], queryFn: () => api('/recruitment/postings') });
  const pipelinesQuery = useQuery<Pipeline[]>({ queryKey: ['recruit-pipelines'], queryFn: () => api('/recruitment/pipelines') });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['recruit-postings'] });

  const save = useMutation({
    mutationFn: () => api(`/recruitment/postings/${editId}`, { method: 'POST', json: form }),
    onSuccess: () => { toast.success('Vaga atualizada.'); setEditId(null); invalidate(); },
    onError: (e: any) => toast.error(e.message || 'Erro.'),
  });
  const publish = useMutation({
    mutationFn: (id: string) => api(`/recruitment/postings/${id}/publish`, { method: 'POST' }),
    onSuccess: () => { toast.success('Vaga publicada.'); invalidate(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao publicar.'),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api(`/recruitment/postings/${id}/status`, { method: 'POST', json: { status } }),
    onSuccess: () => { toast.success('Status atualizado.'); invalidate(); },
    onError: (e: any) => toast.error(e.message || 'Erro.'),
  });

  const postings = listQuery.data ?? [];
  const openEdit = (p: Posting) => { setForm({ ...p }); setEditId(p.id); };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/servico-pessoal/recrutamento" className="flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Requisições</Link>
      </div>
      <PageHeader title="Vagas" description="Vagas criadas a partir de requisições encaminhadas. Edite o texto de divulgação e publique. A descrição técnica original fica protegida." />

      <Card>
        <CardContent className="p-0">
          {postings.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhuma vaga. Crie a partir de uma requisição em recrutamento.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-[10px] uppercase text-muted-foreground">
                  <tr><th className="p-3">Vaga</th><th className="p-3">Visibilidade</th><th className="p-3">Pipeline</th><th className="p-3">Status</th><th className="p-3"></th></tr>
                </thead>
                <tbody className="divide-y">
                  {postings.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="p-3"><div className="font-medium">{p.title}</div><div className="text-[10px] text-muted-foreground">{[p.city, p.workMode, p.contractType].filter(Boolean).join(' · ')}</div></td>
                      <td className="p-3 text-xs">{p.visibility}{p.pcd && <Badge variant="outline" className="ml-1 text-[8px]">PcD</Badge>}</td>
                      <td className="p-3 text-xs">{p.pipelineTemplate?.name ?? '—'}</td>
                      <td className="p-3"><Badge variant="outline" className={cn('text-[10px]', STATUS_TONE[p.status])}>{p.status}</Badge></td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          {canManage && <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>Editar</Button>}
                          {canManage && p.status === 'DRAFT' && <Button variant="outline" size="sm" onClick={() => publish.mutate(p.id)}><Send className="mr-1 h-3.5 w-3.5" /> Publicar</Button>}
                          {canManage && p.status === 'PUBLISHED' && <Button variant="ghost" size="sm" onClick={() => setStatus.mutate({ id: p.id, status: 'PAUSED' })}><Pause className="h-3.5 w-3.5" /></Button>}
                          {p.status === 'PUBLISHED' && <a href={`/carreiras/vagas/${p.slug}`} target="_blank" rel="noreferrer"><Button variant="ghost" size="sm"><ExternalLink className="h-3.5 w-3.5" /></Button></a>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editId)} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader><DialogTitle>Editar vaga (texto de divulgação)</DialogTitle></DialogHeader>
          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            <div><Label>Título público</Label><Input value={form.title ?? ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Descrição pública</Label><Textarea rows={4} value={form.publicDescription ?? ''} onChange={(e) => setForm((f) => ({ ...f, publicDescription: e.target.value }))} /></div>
            <div><Label>Requisitos (público)</Label><Textarea rows={3} value={form.publicRequirements ?? ''} onChange={(e) => setForm((f) => ({ ...f, publicRequirements: e.target.value }))} /></div>
            <div><Label>Benefícios</Label><Textarea rows={2} value={form.benefitsText ?? ''} onChange={(e) => setForm((f) => ({ ...f, benefitsText: e.target.value }))} /></div>
            <div><Label>Etapas do processo</Label><Textarea rows={2} value={form.processStepsText ?? ''} onChange={(e) => setForm((f) => ({ ...f, processStepsText: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cidade</Label><Input value={form.city ?? ''} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></div>
              <div><Label>Modalidade</Label>
                <NativeSelect value={form.workMode ?? ''} onChange={(e) => setForm((f) => ({ ...f, workMode: e.target.value }))}>
                  <option value="">—</option><option value="PRESENCIAL">Presencial</option><option value="HIBRIDO">Híbrido</option><option value="REMOTO">Remoto</option>
                </NativeSelect>
              </div>
              <div><Label>Visibilidade</Label>
                <NativeSelect value={form.visibility ?? 'PUBLIC'} onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value }))}>
                  <option value="PUBLIC">Pública</option><option value="INTERNAL">Interna</option><option value="BOTH">Interna e externa</option><option value="CONFIDENTIAL">Confidencial</option>
                </NativeSelect>
              </div>
              <div><Label>Pipeline</Label>
                <NativeSelect value={form.pipelineTemplateId ?? ''} onChange={(e) => setForm((f) => ({ ...f, pipelineTemplateId: e.target.value }))}>
                  {(pipelinesQuery.data ?? []).map((pl) => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                </NativeSelect>
              </div>
              <div><Label>Encerra em</Label><Input type="date" value={form.closesAt ? String(form.closesAt).slice(0, 10) : ''} onChange={(e) => setForm((f) => ({ ...f, closesAt: e.target.value }))} /></div>
              <div className="flex items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.pcd ?? false} onChange={(e) => setForm((f) => ({ ...f, pcd: e.target.checked }))} /> Vaga PcD</label></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.showSalary ?? false} onChange={(e) => setForm((f) => ({ ...f, showSalary: e.target.checked }))} /> Exibir faixa salarial</label>
              {form.showSalary && <Input placeholder="Ex.: R$ 4.000 a R$ 5.000" value={form.salaryText ?? ''} onChange={(e) => setForm((f) => ({ ...f, salaryText: e.target.value }))} />}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditId(null)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
