'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Calendar, FileText, Loader2, Lock, Send, User } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { EmptyState } from '@/components/platform/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { useAuth } from '@/components/auth/auth-provider';
import Link from 'next/link';
import { useState } from 'react';

interface SupportMessage {
  id: string;
  message: string;
  isInternal: boolean;
  createdAt: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}

interface SupportTicketDetail {
  id: string;
  userId: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  module: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  requesterName: string;
  requesterEmail: string;
  company: { id: string; name: string };
  assignedToUserId: string | null;
  assignedToUser: { id: string; name: string } | null;
  attachments: Array<{ id: string; fileName: string; fileUrl: string; fileType: string; fileSize: number }>;
  messages: SupportMessage[];
}

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();
  const ticketId = params.id as string;

  const [message, setMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Buscar detalhes do chamado
  const { data: ticket, isLoading, refetch } = useQuery<SupportTicketDetail>({
    queryKey: ['support-ticket', ticketId],
    queryFn: () => api(`/support-tickets/${ticketId}`),
    enabled: !!ticketId,
  });

  // Mutação para adicionar mensagem
  const addMessage = useMutation({
    mutationFn: (body: { message: string; isInternal?: boolean }) =>
      api(`/support-tickets/${ticketId}/messages`, {
        method: 'POST',
        json: body,
      }),
    onSuccess: () => {
      setMessage('');
      setIsInternal(false);
      qc.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
      toast.success('Resposta enviada com sucesso.');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível enviar a resposta.'),
  });

  // Mutação para atualizar parâmetros do chamado (status, prioridade, responsável)
  const updateTicket = useMutation({
    mutationFn: (body: { status?: string; priority?: string; assignedToUserId?: string | null }) =>
      api(`/support-tickets/${ticketId}`, {
        method: 'PATCH',
        json: body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success('Chamado atualizado com sucesso.');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao atualizar chamado.'),
  });

  const getPriorityBadgeColor = (prio: string) => {
    switch (prio) {
      case 'Crítica': return 'bg-red-100 text-red-800 border-red-200';
      case 'Alta': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Média': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Resolvido':
      case 'Encerrado':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Cancelado':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'Em atendimento':
      case 'Em análise':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Aguardando retorno do solicitante':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-rose-100 text-rose-800 border-rose-200';
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-muted-foreground bg-white border rounded-md">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando detalhes do chamado...
      </div>
    );
  }

  if (!ticket) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-6 w-6 text-muted-foreground" />}
        title="Chamado não encontrado"
        description="O link fornecido pode estar quebrado ou você não possui permissão de acesso."
        action={
          <Button asChild>
            <Link href="/central-atendimento">Voltar para a Central</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="p-0 h-8 w-8 rounded-full">
          <Link href="/central-atendimento" title="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <span className="text-xs text-muted-foreground">Voltar para listagem</span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Painel Central: Detalhes e Conversa */}
        <div className="flex-1 space-y-4">
          <SectionCard
            title={ticket.title}
            description={`Chamado #${ticket.id.substring(0, 8)} · Criado em ${formatDate(ticket.createdAt)}`}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn('text-xs font-semibold border', getPriorityBadgeColor(ticket.priority))} variant="outline">
                  Prioridade: {ticket.priority}
                </Badge>
                <Badge className={cn('text-xs font-semibold border', getStatusBadgeColor(ticket.status))} variant="outline">
                  Status: {ticket.status}
                </Badge>
              </div>
            }
          >
            <div className="space-y-4">
              <div className="rounded-md border bg-slate-50/50 p-4">
                <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-600">
                  <User className="h-3.5 w-3.5" />
                  <span>{ticket.requesterName} ({ticket.requesterEmail})</span>
                  <span>·</span>
                  <span>Módulo: {ticket.module || 'Geral'}</span>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
                  {ticket.description}
                </div>
              </div>

              {ticket.attachments && ticket.attachments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Evidências e Anexos</h4>
                  <div className="flex flex-wrap gap-2">
                    {ticket.attachments.map((att) => (
                      <div key={att.id} className="flex items-center gap-2 rounded border bg-white px-3 py-1.5 text-xs">
                        <FileText className="h-4 w-4 text-emerald-600" />
                        <span className="font-medium text-slate-700 truncate max-w-40">{att.fileName}</span>
                        <span className="text-muted-foreground">({(att.fileSize / 1024).toFixed(1)} KB)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Timeline de Mensagens / Chat */}
          <SectionCard title="Histórico de Atendimento" description="Mensagens e atualizações deste chamado.">
            <div className="space-y-4">
              {ticket.messages.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  Ainda não há mensagens de resposta neste chamado.
                </div>
              ) : (
                <div className="space-y-4">
                  {ticket.messages.map((msg) => {
                    const isMsgInternal = msg.isInternal;
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          'rounded-lg border p-4 text-sm space-y-2',
                          isMsgInternal
                            ? 'bg-amber-50/70 border-amber-200'
                            : msg.user.id === ticket.userId
                            ? 'bg-emerald-50/30 border-emerald-100'
                            : 'bg-slate-50/50 border-slate-100'
                        )}
                      >
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700">
                              {msg.user.name.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-semibold text-slate-700">{msg.user.name}</span>
                            <span>({msg.user.email})</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isMsgInternal && (
                              <Badge className="text-[9px] bg-amber-200 text-amber-800 border-amber-300 gap-1" variant="outline">
                                <Lock className="h-2.5 w-2.5" /> Interno
                              </Badge>
                            )}
                            <span>{formatDate(msg.createdAt)}</span>
                          </div>
                        </div>
                        <div className="whitespace-pre-wrap leading-6 text-slate-800">
                          {msg.message}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Responder */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!message.trim()) return;
                  addMessage.mutate({ message: message.trim(), isInternal });
                }}
                className="space-y-3 pt-3 border-t"
              >
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escreva sua resposta ou nota de acompanhamento..."
                  rows={3}
                  required
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isSuperAdmin && (
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isInternal}
                          onChange={(e) => setIsInternal(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-slate-300"
                        />
                        <span>Comentário interno (Visível apenas para o suporte)</span>
                      </label>
                    )}
                  </div>
                  <Button type="submit" disabled={addMessage.isPending || !message.trim()} className="gap-2">
                    {addMessage.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Enviar resposta
                  </Button>
                </div>
              </form>
            </div>
          </SectionCard>
        </div>

        {/* Sidebar: Painel Administrativo de Controle */}
        {isSuperAdmin && (
          <aside className="w-full lg:w-80 space-y-4 shrink-0">
            <SectionCard title="Controle do Suporte" description="Ações exclusivas para analistas de suporte.">
              <div className="space-y-4 py-2">
                <div className="grid gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Status do Chamado</label>
                  <NativeSelect
                    value={ticket.status}
                    onChange={(e) => updateTicket.mutate({ status: e.target.value })}
                    disabled={updateTicket.isPending}
                  >
                    <option value="Aberto">Aberto</option>
                    <option value="Em análise">Em análise</option>
                    <option value="Em atendimento">Em atendimento</option>
                    <option value="Aguardando retorno do solicitante">Aguardando retorno</option>
                    <option value="Resolvido">Resolvido</option>
                    <option value="Encerrado">Encerrado</option>
                    <option value="Cancelado">Cancelado</option>
                  </NativeSelect>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Prioridade</label>
                  <NativeSelect
                    value={ticket.priority}
                    onChange={(e) => updateTicket.mutate({ priority: e.target.value })}
                    disabled={updateTicket.isPending}
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                    <option value="Crítica">Crítica</option>
                  </NativeSelect>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Responsável</label>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => updateTicket.mutate({ assignedToUserId: user.id })}
                      disabled={updateTicket.isPending || ticket.assignedToUserId === user.id}
                    >
                      Atribuir a mim
                    </Button>
                    {ticket.assignedToUserId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-red-600 hover:text-red-700"
                        onClick={() => updateTicket.mutate({ assignedToUserId: null })}
                        disabled={updateTicket.isPending}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                  {ticket.assignedToUser ? (
                    <div className="text-xs text-slate-600 font-medium mt-1">
                      Atribuído a: <span className="font-semibold text-slate-800">{ticket.assignedToUser.name}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic mt-1">Fila de chamados sem dono.</div>
                  )}
                </div>

                <div className="border-t pt-3 mt-3 text-xs text-slate-500 space-y-1 bg-slate-50/50 p-2 rounded">
                  <div>Empresa: <strong>{ticket.company.name}</strong></div>
                  <div>Criado por: <strong>{ticket.requesterName}</strong></div>
                  {ticket.closedAt && (
                    <div className="text-emerald-700">Resolvido em: {formatDate(ticket.closedAt)}</div>
                  )}
                </div>
              </div>
            </SectionCard>
          </aside>
        )}
      </div>
    </div>
  );
}
