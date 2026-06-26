'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Filter, Loader2, MessageSquare, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { EmptyState } from '@/components/platform/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { useAuth } from '@/components/auth/auth-provider';
import Link from 'next/link';

interface SupportTicketSummary {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  module: string | null;
  createdAt: string;
  updatedAt: string;
  requesterName: string;
  requesterEmail: string;
  company: { id: string; name: string };
  assignedToUser: { id: string; name: string } | null;
}

const TICKET_TYPES = [
  'Dúvida de uso',
  'Erro no sistema',
  'Solicitação de alteração',
  'Solicitação de melhoria',
  'Cadastro ou permissão',
  'Indicadores',
  'Documentos',
  'Auditorias',
  'Planos de ação',
  'Comunicação interna',
  'Outros',
];

const PRIORITIES = ['Baixa', 'Média', 'Alta', 'Crítica'];

const MODULES = [
  'Geral',
  'Indicadores e Metas',
  'Planos de Ação',
  'Gestão de Documentos (GED)',
  'Auditorias e NCs',
  'Segurança dos Alimentos',
  'Segurança Patrimonial',
  'Cargos e Salários',
  'Comunicação Interna',
  'Outros',
];

export default function CentralAtendimentoPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'meus' | 'empresa' | 'todos'>('meus');

  // Payload do novo chamado
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('');
  const [newPriority, setNewPriority] = useState('Média');
  const [newModule, setNewModule] = useState('Geral');
  const [newDescription, setNewDescription] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<Array<{ fileName: string; fileSize: number; fileType: string; fileUrl: string }>>([]);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isGestor = user?.role === 'COMPANY_ADMIN' || user?.role === 'DIRECTOR' || user?.role === 'MANAGER';

  // Buscar todos os chamados conforme filtros
  const queryParams = new URLSearchParams();
  if (search.trim()) queryParams.set('q', search.trim());
  if (statusFilter) queryParams.set('status', statusFilter);
  if (priorityFilter) queryParams.set('priority', priorityFilter);
  if (typeFilter) queryParams.set('type', typeFilter);

  const { data: tickets = [], isLoading } = useQuery<SupportTicketSummary[]>({
    queryKey: ['support-tickets', search, statusFilter, priorityFilter, typeFilter],
    queryFn: () => api(`/support-tickets?${queryParams.toString()}`),
  });

  // Filtrar chamados no frontend baseado na aba selecionada
  const filteredTickets = useMemo(() => {
    if (activeTab === 'meus') {
      return tickets.filter((t) => t.requesterEmail.toLowerCase() === user?.email.toLowerCase());
    }
    if (activeTab === 'empresa') {
      // Todos da empresa do usuário (excluindo os do super admin se ele não pertencer)
      return tickets.filter((t) => t.company.id === user?.companyId);
    }
    return tickets; // 'todos' (visível apenas para Super Admin)
  }, [tickets, activeTab, user]);

  // Mutação para abrir chamado
  const createTicket = useMutation({
    mutationFn: () =>
      api('/support-tickets', {
        method: 'POST',
        json: {
          title: newTitle,
          description: newDescription,
          type: newType,
          priority: newPriority,
          module: newModule,
          attachments: attachedFiles,
        },
      }),
    onSuccess: () => {
      toast.success('Chamado aberto com sucesso.');
      setIsNewTicketOpen(false);
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      // Resetar form
      setNewTitle('');
      setNewType('');
      setNewPriority('Média');
      setNewModule('Geral');
      setNewDescription('');
      setAttachedFiles([]);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível abrir o chamado.'),
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const nextFiles = Array.from(files).map((file) => ({
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'application/octet-stream',
      fileUrl: '#', // Em um cenário real, enviaríamos o arquivo para um bucket S3/Storage
    }));

    setAttachedFiles((prev) => [...prev, ...nextFiles]);
    toast.success(`${files.length} anexo(s) adicionado(s) com sucesso.`);
  };

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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Central de Atendimento"
        description="Abra solicitações de suporte, tire dúvidas ou envie sugestões de melhorias."
        eyebrow="Suporte"
        actions={
          <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Novo Chamado
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Como podemos ajudar?</DialogTitle>
                <DialogDescription>
                  Abra uma solicitação para dúvidas, suporte, melhorias, correções ou alterações no Gestão 360.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newTitle.trim() || !newType || !newDescription.trim()) {
                    toast.error('Preencha os campos obrigatórios.');
                    return;
                  }
                  createTicket.mutate();
                }}
                className="space-y-4 py-2"
              >
                <div className="grid gap-1.5">
                  <label className="text-sm font-semibold text-slate-800">Título da Solicitação *</label>
                  <Input
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ex.: Erro ao salvar indicador mensal ou Dúvida sobre plano de ação"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <label className="text-sm font-semibold text-slate-800">Tipo de Solicitação *</label>
                    <NativeSelect
                      required
                      value={newType}
                      onChange={(e) => setNewType(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {TICKET_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-sm font-semibold text-slate-800">Módulo Relacionado</label>
                    <NativeSelect
                      value={newModule}
                      onChange={(e) => setNewModule(e.target.value)}
                    >
                      {MODULES.map((mod) => (
                        <option key={mod} value={mod}>{mod}</option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <label className="text-sm font-semibold text-slate-800">Prioridade *</label>
                    <NativeSelect
                      required
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value)}
                    >
                      {PRIORITIES.map((prio) => (
                        <option key={prio} value={prio}>{prio}</option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-sm font-semibold text-slate-800">Anexos / Prints de Evidência</label>
                    <Input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="cursor-pointer file:mr-2 file:border-0 file:bg-transparent file:text-sm file:font-semibold"
                    />
                  </div>
                </div>

                {attachedFiles.length > 0 && (
                  <div className="rounded-md border bg-slate-50 p-2 text-xs">
                    <div className="font-semibold mb-1">Arquivos anexados:</div>
                    <ul className="list-disc pl-4 space-y-1">
                      {attachedFiles.map((f, i) => (
                        <li key={i}>{f.fileName} ({(f.fileSize / 1024).toFixed(1)} KB)</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid gap-1.5">
                  <label className="text-sm font-semibold text-slate-800">Descrição Detalhada *</label>
                  <Textarea
                    required
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    rows={4}
                    placeholder="Descreva detalhadamente o problema ou solicitação, incluindo passos para reproduzir se for um erro."
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsNewTicketOpen(false)}
                    disabled={createTicket.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createTicket.isPending}>
                    {createTicket.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      'Abrir chamado'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <SectionCard title="Painel de Filtros" description="Pesquise e refine a listagem de chamados cadastrados.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título ou descrição..."
              className="pl-9"
            />
          </div>
          <div>
            <NativeSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Todos os Status</option>
              <option value="Aberto">Aberto</option>
              <option value="Em análise">Em análise</option>
              <option value="Em atendimento">Em atendimento</option>
              <option value="Aguardando retorno do solicitante">Aguardando retorno</option>
              <option value="Resolvido">Resolvido</option>
              <option value="Encerrado">Encerrado</option>
              <option value="Cancelado">Cancelado</option>
            </NativeSelect>
          </div>
          <div>
            <NativeSelect value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="">Todas as Prioridades</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <NativeSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">Todos os Tipos</option>
              {TICKET_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </NativeSelect>
          </div>
        </div>
      </SectionCard>

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
        <TabsList>
          <TabsTrigger value="meus">Meus Chamados</TabsTrigger>
          {(isGestor || isSuperAdmin) && (
            <TabsTrigger value="empresa">Chamados da Empresa</TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="todos">Painel de Suporte (Todos)</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value={activeTab} className="mt-3">
          {isLoading && (
            <div className="flex items-center justify-center py-20 text-sm text-muted-foreground bg-white border rounded-md">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando chamados...
            </div>
          )}

          {!isLoading && filteredTickets.length === 0 && (
            <EmptyState
              icon={<MessageSquare className="h-6 w-6 text-muted-foreground" />}
              title="Nenhum chamado encontrado"
              description="Use o botão 'Novo Chamado' no topo da tela para abrir uma nova solicitação."
            />
          )}

          {!isLoading && filteredTickets.length > 0 && (
            <div className="overflow-x-auto rounded-md border bg-white">
              <table className="w-full border-collapse text-left text-sm text-slate-800">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                  <tr>
                    <th className="px-4 py-3">Chamado</th>
                    {isSuperAdmin && activeTab === 'todos' && <th className="px-4 py-3">Empresa</th>}
                    <th className="px-4 py-3">Tipo / Módulo</th>
                    <th className="px-4 py-3">Solicitante</th>
                    <th className="px-4 py-3">Prioridade</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="font-semibold max-w-xs truncate text-slate-900" title={ticket.title}>
                          {ticket.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          #{ticket.id.substring(0, 8)} · Aberto em {formatDate(ticket.createdAt)}
                        </div>
                      </td>
                      {isSuperAdmin && activeTab === 'todos' && (
                        <td className="px-4 py-3 text-xs font-medium text-slate-700">
                          {ticket.company.name}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium">{ticket.type}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{ticket.module || 'Geral'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium">{ticket.requesterName}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{ticket.requesterEmail}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={cn('text-[10px] font-semibold border', getPriorityBadgeColor(ticket.priority))} variant="outline">
                          {ticket.priority}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={cn('text-[10px] font-semibold border', getStatusBadgeColor(ticket.status))} variant="outline">
                          {ticket.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/central-atendimento/detalhes/${ticket.id}`}>
                            Ver detalhes
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
