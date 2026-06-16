'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, ClipboardList, ExternalLink, FileText, RefreshCw, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

interface WorkItem {
  id: string;
  itemType: string;
  title: string;
  summary?: string | null;
  status: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  dueAt?: string | null;
  overdueDays: number;
  sourceEntityType: string;
  sourceEntityId: string;
  recommendedAction?: string | null;
  availableActions?: Array<{ key: string; label: string; href?: string | null; inline?: boolean; requiresJustification?: boolean }> | null;
}

const PRIORITY_CLASS: Record<string, string> = {
  CRITICAL: 'bg-rose-100 text-rose-700',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-emerald-100 text-emerald-700',
  INFO: 'bg-sky-100 text-sky-700',
};

export default function TarefasPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [section, setSection] = useState<'all' | 'documents'>('all');
  const itemType = section === 'documents' ? '&itemType=DOCUMENTS' : '';
  const items = useQuery<{ rows: WorkItem[]; total: number }>({
    queryKey: ['tasks', section],
    queryFn: () => api(`/my-day/items?tab=pending&pageSize=80${itemType}`),
  });
  const refresh = useMutation({
    mutationFn: () => api('/my-day/refresh', { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['my-day'] });
      toast.success('Tarefas atualizadas');
    },
  });
  const act = useMutation({
    mutationFn: ({ id, action, justification }: { id: string; action: string; justification?: string }) =>
      api(`/my-day/items/${id}/action`, { method: 'POST', json: { action, justification } }),
    onSuccess: (res: any) => {
      if (res?.redirect) {
        router.push(res.redirect);
        return;
      }
      toast.success(res?.message ?? 'Ação registrada');
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['my-day'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível executar a ação'),
  });

  const rows = items.data?.rows ?? [];

  function openItem(item: WorkItem) {
    const href = item.availableActions?.find((action) => action.key === 'open')?.href;
    if (href) router.push(href);
  }

  function rejectDocument(item: WorkItem) {
    const justification = window.prompt('Justificativa da rejeicao');
    if (justification) act.mutate({ id: item.id, action: 'reject', justification });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tarefas"
        description="Caixa de trabalho do usuário, com uma seção dedicada a documentos e espaco para novos tipos de tarefa."
        actions={<Button variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>}
      />

      <Tabs value={section} onValueChange={(value) => setSection(value as 'all' | 'documents')} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all"><ClipboardList className="mr-2 h-4 w-4" />Todas</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="mr-2 h-4 w-4" />Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value={section} className="space-y-3">
          {items.isLoading && <div className="rounded-md border p-6 text-sm text-muted-foreground">Carregando tarefas...</div>}
          {!items.isLoading && rows.length === 0 && <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">Nenhuma tarefa pendente nesta seção.</div>}
          {rows.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={cn('border-0', PRIORITY_CLASS[item.priority] ?? PRIORITY_CLASS.MEDIUM)}>{item.priority}</Badge>
                    <Badge variant="outline">{item.itemType}</Badge>
                    {item.overdueDays > 0 && <Badge variant="outline" className="border-rose-300 text-rose-600">Atrasada {item.overdueDays}d</Badge>}
                  </div>
                  <div className="mt-2 font-medium">{item.title}</div>
                  {item.summary && <div className="mt-1 text-sm text-muted-foreground">{item.summary}</div>}
                  <div className="mt-1 text-xs text-muted-foreground">{item.dueAt ? `Prazo: ${formatDate(item.dueAt)}` : 'Sem prazo definido'}{item.recommendedAction ? ` - ${item.recommendedAction}` : ''}</div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {item.itemType === 'DOCUMENT_EDIT_APPROVAL' && (
                    <>
                      <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ id: item.id, action: 'approve' })}><ShieldCheck className="mr-2 h-4 w-4" />Liberar</Button>
                      <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => rejectDocument(item)}>Rejeitar</Button>
                    </>
                  )}
                  {item.itemType === 'DOCUMENT_EDIT' && (
                    <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ id: item.id, action: 'complete' })}><CheckCircle2 className="mr-2 h-4 w-4" />Concluir</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openItem(item)}><ExternalLink className="mr-2 h-4 w-4" />Abrir</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
