'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shell/page-header';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Workflow,
  Search,
  Sparkles,
  ArrowRight,
  GitBranch,
  ShieldCheck,
  Bell,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  module: string;
  category: string;
  templateData: string;
  isGlobal: boolean;
  status: string;
  createdAt: string;
}

export default function TemplatesCatalogPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');

  // Fetch workflow templates list
  const { data: templates = [], isLoading } = useQuery<WorkflowTemplate[]>({
    queryKey: ['automations', 'templates'],
    queryFn: () => api<WorkflowTemplate[]>('/automations/workflow-templates'),
  });

  // Mutation to instantiate a new workflow from a template
  const useTemplateMutation = useMutation({
    mutationFn: (id: string) => api<{ id: string }>(`/automations/workflow-templates/${id}/use`, { method: 'POST' }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['automations', 'workflows'] });
      toast.success('Fluxo criado com sucesso a partir do modelo!');
      // Redirect straight to visual builder with the new definition ID
      router.push(`/central-automacoes/fluxos/construtor?id=${data.id}`);
    },
    onError: (err: any) => {
      toast.error(`Falha ao criar fluxo: ${err.message}`);
    },
  });

  const modules = ['ALL', 'INDICATORS', 'DOCUMENTS', 'AUDITS', 'FORMS', 'ACTIONS'];

  const getModuleLabel = (mod: string) => {
    switch (mod) {
      case 'INDICATORS':
        return 'Indicadores';
      case 'DOCUMENTS':
        return 'Documentos e GED';
      case 'AUDITS':
        return 'Auditorias';
      case 'FORMS':
        return 'Listas de verificação e Formulários';
      case 'ACTIONS':
        return 'Planos de Ação';
      default:
        return mod;
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'APPROVAL':
        return <ShieldCheck className="h-4 w-4 text-purple-500" />;
      case 'NOTIFICATION':
        return <Bell className="h-4 w-4 text-blue-500" />;
      case 'TASK':
        return <GitBranch className="h-4 w-4 text-emerald-500" />;
      case 'INTEGRATION':
        return <ExternalLink className="h-4 w-4 text-amber-500" />;
      default:
        return <Workflow className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'APPROVAL':
        return 'Aprovação';
      case 'NOTIFICATION':
        return 'Notificação';
      case 'TASK':
        return 'Atividade';
      case 'INTEGRATION':
        return 'Integração';
      default:
        return cat;
    }
  };

  const filtered = templates.filter((t) => {
    const matchesModule = selectedModule === 'ALL' ? true : t.module === selectedModule;
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesModule && matchesSearch;
  });

  return (
    <div className="p-6 space-y-6 flex-1 flex flex-col min-h-0">
      <PageHeader
        eyebrow="Central de Automações"
        title="Modelos de Workflows Prontos"
        description="Acelere o design do seu processo escolhendo um dos nossos modelos homologados para conformidade regulatória e melhoria contínua."
      />

      {/* Filters and search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 border rounded-xl shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          {modules.map((mod) => (
            <Button
              key={mod}
              variant={selectedModule === mod ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setSelectedModule(mod)}
            >
              {mod === 'ALL' ? 'Todos' : getModuleLabel(mod)}
            </Button>
          ))}
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar modelos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border rounded-lg focus:outline-none"
          />
        </div>
      </div>

      {/* Catalog Cards Grid */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="text-center text-xs py-16 text-muted-foreground animate-pulse">
            Carregando biblioteca de modelos...
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
            {filtered.map((item) => {
              const nodesCount = (() => {
                try {
                  const data = JSON.parse(item.templateData);
                  return data?.nodes?.length || 0;
                } catch {
                  return 0;
                }
              })();

              return (
                <div
                  key={item.id}
                  className="bg-card border rounded-xl hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group relative"
                >
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase">
                        {getModuleLabel(item.module)}
                      </span>
                      <div className="flex items-center gap-1 bg-primary/5 px-2 py-0.5 rounded text-[10px] font-semibold text-primary">
                        {getCategoryIcon(item.category)}
                        <span>{getCategoryLabel(item.category)}</span>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-foreground leading-tight group-hover:text-primary transition-colors">
                        {item.name}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-3">
                        {item.description || 'Modelo de automação homologado pronto para implantação rápida.'}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-muted/10 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <GitBranch className="h-3.5 w-3.5 opacity-70" />
                      <span>{nodesCount} etapas no fluxo</span>
                    </div>

                    <Button
                      size="sm"
                      className="h-8 text-xs font-semibold flex items-center gap-1 opacity-90 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                      disabled={useTemplateMutation.isPending}
                      onClick={() => useTemplateMutation.mutate(item.id)}
                    >
                      <span>Ativar Modelo</span>
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-xs text-muted-foreground border border-dashed rounded-xl bg-card">
            <Workflow className="h-8 w-8 opacity-40 mb-2" />
            <span>Nenhum modelo encontrado correspondente aos filtros.</span>
          </div>
        )}
      </div>
    </div>
  );
}
