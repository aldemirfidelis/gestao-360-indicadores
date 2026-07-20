'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Download, ShieldCheck, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/platform/confirm-dialog';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';

interface DataRequest {
  id: string;
  type: 'ACCESS' | 'DELETION' | 'RECTIFICATION' | 'PORTABILITY';
  status: 'OPEN' | 'DONE' | 'REJECTED';
  details: string | null;
  requestedAt: string;
  resolvedAt: string | null;
  candidate: { id: string; name: string; email: string; status: string };
}

const TYPE_LABEL: Record<string, string> = {
  ACCESS: 'Acesso aos dados',
  DELETION: 'Exclusão / anonimização',
  RECTIFICATION: 'Retificação',
  PORTABILITY: 'Portabilidade',
};
const STATUS_TONE: Record<string, string> = {
  OPEN: 'bg-amber-100 text-amber-800',
  DONE: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-800',
};
const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Aberta',
  DONE: 'Atendida',
  REJECTED: 'Recusada',
};

export default function RecruitmentLgpdPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canHandle = hasPermission(['recruit:lgpd', 'recruit:manage']);
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [selected, setSelected] = useState<DataRequest | null>(null);
  const [note, setNote] = useState('');
  const [anonymizeConfirm, setAnonymizeConfirm] = useState(false);

  const listQuery = useQuery<DataRequest[]>({
    queryKey: ['recruit-data-requests', statusFilter],
    queryFn: () => api(`/recruitment/data-requests${statusFilter ? `?status=${statusFilter}` : ''}`),
    enabled: canHandle,
  });

  const resolve = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'DONE' | 'REJECTED' }) =>
      api(`/recruitment/data-requests/${id}/resolve`, { method: 'POST', json: { action, note: note || undefined } }),
    onSuccess: () => {
      toast.success('Solicitação encerrada.');
      setSelected(null);
      setNote('');
      void qc.invalidateQueries({ queryKey: ['recruit-data-requests'] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao encerrar solicitação.'),
  });

  async function exportData(candidateId: string, candidateName: string) {
    try {
      const data = await api(`/recruitment/candidates/${candidateId}/data-export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dados-candidato-${candidateName.replace(/\s+/g, '-').toLowerCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exportação gerada.');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao exportar dados.');
    }
  }

  function confirmResolve(action: 'DONE' | 'REJECTED') {
    if (!selected) return;
    if (action === 'DONE' && selected.type === 'DELETION') {
      setAnonymizeConfirm(true);
      return;
    }
    resolve.mutate({ id: selected.id, action });
  }

  const requests = listQuery.data ?? [];

  if (!canHandle) {
    return (
      <div className="space-y-4">
        <PageHeader title="Solicitações LGPD" description="Direitos do titular (candidatos)." />
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Você não tem permissão para atender solicitações LGPD.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Solicitações LGPD"
        description="Direitos do titular abertos pelos candidatos no portal (acesso, exclusão, retificação, portabilidade)."
        actions={
          <NativeSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 w-40">
            <option value="OPEN">Em aberto</option>
            <option value="DONE">Atendidas</option>
            <option value="REJECTED">Recusadas</option>
            <option value="">Todas</option>
          </NativeSelect>
        }
      />

      <Card>
        <CardContent className="p-0">
          {requests.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhuma solicitação nesse filtro.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-[10px] uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Candidato</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Solicitado em</th>
                    <th className="p-3">Status</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20">
                      <td className="p-3">
                        <div className="font-medium">{r.candidate.name}</div>
                        <div className="text-[11px] text-muted-foreground">{r.candidate.email}</div>
                      </td>
                      <td className="p-3 text-xs">{TYPE_LABEL[r.type] ?? r.type}</td>
                      <td className="p-3 text-xs">{new Date(r.requestedAt).toLocaleString('pt-BR')}</td>
                      <td className="p-3"><Badge variant="outline" className={cn('text-[10px]', STATUS_TONE[r.status])}>{STATUS_LABEL[r.status] ?? r.status}</Badge></td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => { setSelected(r); setNote(''); }}>Abrir</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-sky-500" /> {TYPE_LABEL[selected.type] ?? selected.type}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-medium">{selected.candidate.name}</div>
                  <div className="text-xs text-muted-foreground">{selected.candidate.email}</div>
                </div>
                {selected.details && <div className="rounded-md bg-muted/40 p-3 text-xs whitespace-pre-wrap">{selected.details}</div>}

                {(selected.type === 'ACCESS' || selected.type === 'PORTABILITY') && (
                  <Button variant="outline" size="sm" onClick={() => exportData(selected.candidate.id, selected.candidate.name)}>
                    <Download className="mr-2 h-4 w-4" /> Exportar dados do candidato (JSON)
                  </Button>
                )}
                {selected.type === 'DELETION' && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    Atender esta solicitação anonimiza o cadastro do candidato (nome, e-mail, telefone,
                    perfil e documentos) de forma irreversível. O histórico da candidatura é preservado
                    sem dados pessoais, para defesa do processo seletivo.
                  </div>
                )}

                {selected.status === 'OPEN' ? (
                  <>
                    <div>
                      <Label>Nota da resolução (opcional)</Label>
                      <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Ex.: dados exportados e enviados por e-mail em 15/07." />
                    </div>
                    <DialogFooter className="gap-2">
                      <Button variant="outline" disabled={resolve.isPending} onClick={() => confirmResolve('REJECTED')}>
                        <XCircle className="mr-2 h-4 w-4" /> Recusar
                      </Button>
                      <Button disabled={resolve.isPending} onClick={() => confirmResolve('DONE')}>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar como atendida
                      </Button>
                    </DialogFooter>
                  </>
                ) : (
                  <Badge variant="outline" className={cn('text-[10px]', STATUS_TONE[selected.status])}>{STATUS_LABEL[selected.status] ?? selected.status}</Badge>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={anonymizeConfirm}
        onOpenChange={setAnonymizeConfirm}
        title="Anonimizar dados do candidato"
        description={
          selected
            ? `Isso anonimiza permanentemente o cadastro de ${selected.candidate.name} (nome, e-mail, telefone e currículos). A ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Anonimizar permanentemente"
        destructive
        onConfirm={() => { if (selected) resolve.mutate({ id: selected.id, action: 'DONE' }); }}
      />
    </div>
  );
}
