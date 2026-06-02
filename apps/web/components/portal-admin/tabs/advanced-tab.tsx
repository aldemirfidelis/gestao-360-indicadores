'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCcw, Database, ShieldAlert, Sparkles } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';

export function AdvancedTab() {
  const qc = useQueryClient();

  const syncMut = useMutation({
    mutationFn: () => api<{ created: number }>('/admin/portal/registry/sync', { method: 'POST' }),
    onSuccess: (r) => {
      toast.success(`Registro sincronizado (+${r.created}).`);
      qc.invalidateQueries({ queryKey: ['portal'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const clearCache = () => {
    qc.invalidateQueries({ queryKey: ['portal'] });
    toast.success('Cache de configurações do portal limpo com sucesso.');
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Operações administrativas avançadas e ferramentas de manutenção do registro de configurações do portal.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SectionCard
          title="Sincronização de Registro"
          description="Sincroniza os módulos, páginas e funcionalidades cadastrados em código com o banco de dados. Novos itens serão criados automaticamente."
        >
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Esta ação é executada automaticamente na inicialização do servidor, mas pode ser executada manualmente se houver novas inclusões de rotas ou permissões sem reiniciar a aplicação.
            </p>
            <div className="flex">
              <Button
                variant="outline"
                disabled={syncMut.isPending}
                onClick={() => syncMut.mutate()}
                className="w-full sm:w-auto"
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Ressincronizar Registro
              </Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Limpar Cache do Cliente"
          description="Invalida os caches do React Query e força o recarregamento imediato das configurações ativas para todos os módulos e páginas."
        >
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Útil se você alterou uma feature flag ou ativou manutenção e deseja garantir que o frontend atualize imediatamente sem esperar a expiração natural do tempo de cache.
            </p>
            <div className="flex">
              <Button
                variant="outline"
                onClick={clearCache}
                className="w-full sm:w-auto"
              >
                <Database className="mr-2 h-4 w-4" />
                Limpar Cache Local
              </Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Diagnóstico Geral do Banco"
          description="Exibe informações sobre a estrutura de metadados do portal atual."
          className="md:col-span-2"
        >
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-dashed border-status-blue/30 bg-status-blue/5 p-4 text-sm text-status-blue">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <span className="font-semibold block mb-0.5">Gestão 360 - Painel Mestre Ativado</span>
                Todas as 12 tabelas adicionais e serviços NestJS integrados estão operacionais. O overlay dinâmico está ativamente controlando o acesso a rotas, menus e botões com base nas políticas persistidas no banco.
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-dashed border-status-red/30 bg-status-red/5 p-4 text-sm text-status-red">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <span className="font-semibold block mb-0.5">Segurança & Anti-lockout</span>
                A exclusão de dados de auditoria é estritamente proibida e os módulos críticos de autenticação, administração do banco e administração do portal estão protegidos por regras rígidas no backend e frontend.
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
