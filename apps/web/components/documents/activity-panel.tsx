'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Activity, AtSign, FileClock, History, Loader2, MessageSquare, Send, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { STATUS_LABEL, formatDateTime, type DocDetail, type DocOptions, type DocStatus } from './types';
import { MultiSelect, Timeline, errorMessage, invalidateDocuments, userOptions } from './ui';

const AUDIT_LABEL: Record<string, string> = {
  CREATE: 'Documento criado',
  UPDATE_METADATA: 'Dados alterados',
  STATUS_CHANGE: 'Status alterado',
  UPLOAD_FILE: 'Arquivo enviado',
  DOWNLOAD: 'Download controlado',
  COMMENT: 'Comentário',
  CONTENT_FORMAT: 'Formato do conteúdo trocado',
  ACCESS_UPDATED: 'Acesso alterado',
  WORKFLOW_PARTICIPANTS: 'Participantes do fluxo definidos',
  CHANGE_REQUESTED: 'Alteração solicitada',
  CHANGE_REQUEST_ACCEPTED: 'Solicitação aceita',
  CHANGE_REQUEST_REJECTED: 'Solicitação recusada',
  PUBLISH: 'Publicação',
  PUBLISH_SCHEDULED: 'Publicação agendada',
  NEW_REVISION: 'Nova revisão aberta',
  DISPOSED: 'Descarte após a guarda',
  SOFT_DELETE: 'Exclusão',
  EDIT_REQUESTED: 'Pedido de edição',
  EDIT_GRANTED: 'Edição liberada',
  EDIT_APPROVED: 'Edição liberada',
  EDIT_REJECTED: 'Pedido de edição recusado',
  EDIT_COMPLETED: 'Edição encerrada',
  SIGNATURE: 'Assinatura',
  READ_CONFIRMED: 'Leitura confirmada',
  DISTRIBUTION_UPDATED: 'Distribuição alterada',
  WORKFLOW_SUBMITTED: 'Enviado para análise',
  WORKFLOW_DELEGATED: 'Etapa delegada',
  WORKFLOW_CANCELLED: 'Retirado do fluxo',
};

const ROLE_LABEL: Record<string, string> = { REVIEWER: 'Revisão', APPROVER: 'Aprovação', PUBLISHER: 'Publicação' };
const DECISION_LABEL: Record<string, string> = { APPROVED: 'aprovou', REJECTED: 'reprovou', ADJUSTMENTS_REQUESTED: 'pediu ajustes', PENDING: 'pendente' };

export function ActivityPanel({ doc, options }: { doc: DocDetail; options: DocOptions | undefined }) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);

  const comment = useMutation({
    mutationFn: () => api(`/documents/${doc.id}/comments`, { method: 'POST', json: { body: body.trim(), mentionUserIds: mentions } }),
    onSuccess: () => {
      toast.success(mentions.length ? 'Comentário enviado e pessoas avisadas.' : 'Comentário registrado.');
      setBody('');
      setMentions([]);
      invalidateDocuments(qc);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const signatures = useMemo(() => doc.approvals.filter((item) => item.decidedAt), [doc.approvals]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-4 w-4" />Comentários internos</CardTitle>
          <CardDescription>Use para alinhar o conteúdo. Mencione pessoas para avisá-las.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={3} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Escreva um comentário…" />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="flex-1">
              <MultiSelect options={userOptions(options?.users)} value={mentions} onChange={setMentions} placeholder="@ mencionar pessoas (opcional)" max={20} />
            </div>
            <Button size="sm" disabled={!body.trim() || comment.isPending} onClick={() => comment.mutate()}>
              {comment.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
              Comentar
            </Button>
          </div>
          <Timeline
            empty="Nenhum comentário ainda."
            items={doc.comments.map((item) => ({
              id: item.id,
              icon: <AtSign className="h-3.5 w-3.5" />,
              title: item.user?.name ?? 'Usuário',
              meta: formatDateTime(item.createdAt),
              body: item.body,
            }))}
          />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" />Assinaturas</CardTitle>
            <CardDescription>Cada assinatura registra a senha confirmada, data/hora e o código de verificação.</CardDescription>
          </CardHeader>
          <CardContent>
            <Timeline
              empty="Nenhuma assinatura registrada."
              items={signatures.map((item) => ({
                id: item.id,
                icon: <ShieldCheck className="h-3.5 w-3.5" />,
                title: `${item.user?.name ?? 'Usuário'} ${DECISION_LABEL[item.decision] ?? item.decision.toLowerCase()}`,
                meta: `${ROLE_LABEL[item.approverRole ?? ''] ?? item.approverRole ?? 'Decisão'} · ${formatDateTime(item.decidedAt)}${item.signatureHash ? ` · código ${item.signatureHash}` : ''}`,
                body: item.comment,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" />Histórico de status</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline
              items={doc.statusHistory.slice(0, 40).map((item) => ({
                id: item.id,
                icon: <FileClock className="h-3.5 w-3.5" />,
                title: `${item.statusFrom ? `${STATUS_LABEL[item.statusFrom as DocStatus] ?? item.statusFrom} → ` : ''}${STATUS_LABEL[item.statusTo as DocStatus] ?? item.statusTo}`,
                meta: `${item.user?.name ?? 'Sistema'} · ${formatDateTime(item.createdAt)}`,
                body: item.comment,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" />Trilha de auditoria</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline
              items={doc.auditLogs.slice(0, 60).map((item) => ({
                id: item.id,
                icon: <Activity className="h-3.5 w-3.5" />,
                title: AUDIT_LABEL[item.action] ?? item.action,
                meta: `${item.user?.name ?? 'Sistema'} · ${formatDateTime(item.createdAt)}`,
                body: item.reason,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
