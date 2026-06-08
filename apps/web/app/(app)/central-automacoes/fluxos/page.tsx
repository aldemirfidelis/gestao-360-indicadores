'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  GitBranch,
  Search,
  Plus,
  Play,
  Copy,
  Trash2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  module: string;
  category: string;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  updatedAt: string;
  createdBy?: { name: string };
}

export default function WorkflowsList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');

  // Load workflows list
  const { data: workflows = [], isLoading } = useQuery<Workflow[]>({
    queryKey: ['automations', 'workflows'],
    queryFn: () => api<Workflow[]>('/automations/workflows'),
  });

  // Duplicate workflow mutation
  const duplicateMutation = useMutation({
    mutationFn: (id: string) => api(`/automations/workflows/${id}/duplicate`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations', 'workflows'] });
      toast.success('Workflow duplicado com sucesso!');
    },
    onError: (err: any) => {
      toast.error(`Falha ao duplicar workflow: ${err.message}`);
    },
  });

  // Delete workflow mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/automations/workflows/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations', 'workflows'] });
      toast.success('Workflow arquivado com sucesso!');
    },
    onError: (err: any) => {
      toast.error(`Falha ao arquivar: ${err.message}`);
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/automations/workflows/${id}`, {
        method: 'PUT',
        json: { status },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations', 'workflows'] });
      toast.success('Status do fluxo atualizado!');
    },
  });

  const filteredWorkflows = workflows.filter((w) => {
    const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesModule = moduleFilter ? w.module === moduleFilter : true;
    return matchesSearch && matchesModule;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          eyebrow="Central de Automações"
          title="Meus Fluxos"
          description="Consulte, edite e configure as automações corporativas mapeadas para os módulos de gestão."
        />
        <Button className="shrink-0 flex items-center gap-1.5 self-start sm:self-center" asChild>
          <Link href="/central-automacoes/fluxos/construtor?new=true">
            <Plus className="h-4 w-4" />
            Novo Fluxo
          </Link>
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-card/45 p-4 rounded-xl border">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Pesquisar fluxos por nome ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-background border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="w-full sm:w-48 px-3 py-2 text-xs bg-background border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Todos os Módulos</option>
          <option value="INDICATORS">Indicadores</option>
          <option value="DOCUMENTS">Documentos</option>
          <option value="AUDITS">Auditorias</option>
          <option value="FORMS">Formulários</option>
          <option value="ACTIONS">Planos de Ação</option>
        </select>
      </div>

      {/* Grid de Fluxos */}
      {isLoading ? (
        <div className="text-center text-sm py-12 text-muted-foreground animate-pulse">Carregando lista de fluxos...</div>
      ) : filteredWorkflows.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredWorkflows.map((flow) => {
            const isActive = flow.status === 'ACTIVE';

            return (
              <div key={flow.id} className="bg-card border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between min-h-[180px]">
                {/* Badge de Módulo */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {flow.module}
                  </span>
                  <span className={cn(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                    flow.status === 'ACTIVE' && 'bg-status-green/10 text-status-green',
                    flow.status === 'INACTIVE' && 'bg-status-orange/10 text-status-orange',
                    flow.status === 'DRAFT' && 'bg-muted text-muted-foreground'
                  )}>
                    {flow.status === 'ACTIVE' ? 'Ativo' : flow.status === 'INACTIVE' ? 'Inativo' : 'Rascunho'}
                  </span>
                </div>

                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground truncate">{flow.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {flow.description || 'Nenhuma descrição informada para este fluxo.'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t flex items-center justify-between gap-2">
                  <div className="text-[10px] text-muted-foreground">
                    Modificado {new Date(flow.updatedAt).toLocaleDateString()}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Botão de Toggle Ativar/Desativar */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => toggleStatusMutation.mutate({ id: flow.id, status: isActive ? 'INACTIVE' : 'ACTIVE' })}
                      title={isActive ? 'Desativar Fluxo' : 'Ativar Fluxo'}
                    >
                      {isActive ? <ToggleRight className="h-4 w-4 text-status-green" /> : <ToggleLeft className="h-4 w-4" />}
                    </Button>

                    {/* Botão Duplicar */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => duplicateMutation.mutate(flow.id)}
                      title="Duplicar Fluxo"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>

                    {/* Botão Editar / Ver Canvas */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                      asChild
                      title="Abrir Construtor"
                    >
                      <Link href={`/central-automacoes/fluxos/construtor?id=${flow.id}`}>
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    </Button>

                    {/* Botão Deletar */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (confirm('Tem certeza de que deseja arquivar este fluxo?')) {
                          deleteMutation.mutate(flow.id);
                        }
                      }}
                      title="Arquivar Fluxo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-2xl bg-card/25">
          <GitBranch className="h-10 w-10 text-muted-foreground opacity-50 mb-3" />
          <h3 className="text-sm font-semibold">Nenhum fluxo encontrado</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm text-center leading-relaxed">
            Seja o primeiro a desenhar um fluxo ou importe um dos modelos prontos na Biblioteca.
          </p>
        </div>
      )}
    </div>
  );
}
