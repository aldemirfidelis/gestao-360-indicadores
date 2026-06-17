'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Send, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';

interface Approver {
  userId: string;
  name: string;
  email: string;
  role: string;
  orgNodeName: string;
  level: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  annexId: string;
  versionId: string;
  onDone: () => void;
}

export function SubmitValidationDialog({ open, onOpenChange, annexId, versionId, onDone }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: approvers = [], isLoading } = useQuery({
    queryKey: ['prize-annex-approvers', annexId],
    queryFn: () => api<Approver[]>(`/prize/annexes/${annexId}/approvers`),
    enabled: open,
  });

  useEffect(() => {
    if (open) setSelected(new Set(approvers.map((a) => a.userId)));
  }, [open, approvers]);

  const submit = useMutation({
    mutationFn: () => api(`/prize/annexes/versions/${versionId}/submit`, { method: 'POST', json: { approverUserIds: Array.from(selected) } }),
    onSuccess: () => { toast.success('Anexo enviado para validação'); onDone(); onOpenChange(false); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const levelLabel = (level: number) => (level === 0 ? 'Gestor imediato' : level === 1 ? 'Gestor acima' : `Nível ${level} acima`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Enviar para validação</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" />Escolha os gestores da área que devem validar/aprovar este anexo (do gestor imediato ao superintendente).</p>

          {isLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Carregando gestores…</p>
          ) : approvers.length === 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              Nenhum gestor encontrado para a área deste anexo. Defina os responsáveis das áreas no Organograma para rotear automaticamente.
              Você pode enviar para validação mesmo assim (sem destinatário específico).
            </div>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {approvers.map((a) => (
                <label key={a.userId} className="flex cursor-pointer items-center gap-3 rounded-md border border-border/60 p-2 hover:bg-muted/40">
                  <input type="checkbox" checked={selected.has(a.userId)} onChange={() => toggle(a.userId)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{a.name}</span>
                      <Badge variant="outline" className="text-[10px]">{levelLabel(a.level)}</Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{a.orgNodeName} · {a.role} · {a.email}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending || (approvers.length > 0 && selected.size === 0)}>
            <Send className="mr-1 h-3.5 w-3.5" />{submit.isPending ? 'Enviando…' : 'Enviar para validação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
