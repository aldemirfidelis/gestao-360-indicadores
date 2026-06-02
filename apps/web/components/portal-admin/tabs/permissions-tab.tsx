'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Shield, Users, Lock, ChevronRight, RefreshCcw } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface PermissionOverview {
  profiles: {
    id: string;
    code: string;
    name: string;
    role: string;
    status: string;
    system: boolean;
    _count: { users: number; permissions: number };
  }[];
  permissionModules: { module: string; count: number }[];
  totalPermissions: number;
  usersByRole: { role: string; count: number }[];
  note: string;
}

export function PermissionsTab() {
  const query = useQuery<PermissionOverview>({
    queryKey: ['portal', 'permissions-overview'],
    queryFn: () => api('/admin/portal/permissions'),
    refetchOnWindowFocus: false,
  });

  const data = query.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Estrutura geral de perfis e permissões do sistema (RBAC). A edição detalhada e vinculação é feita em Segurança.
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/settings?tab=security" className="flex items-center gap-1.5">
              Configurações de Segurança <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCcw className={cn('mr-2 h-4 w-4', query.isFetching && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      </div>

      {query.isLoading && <LoadingState label="Lendo perfis e permissões..." />}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* Perfis de Acesso */}
          <SectionCard title="Perfis de Acesso Cadastrados" description="Estrutura de perfis ativos na empresa." className="lg:col-span-2" contentClassName="p-0">
            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th className="text-left">Perfil</th>
                    <th className="text-left">Papel do Sistema (Role)</th>
                    <th className="text-left">Usuários</th>
                    <th className="text-left">Permissões Ativas</th>
                    <th className="text-left">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.profiles.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="font-semibold text-sm">{p.name}</div>
                        <div className="font-mono text-[9px] text-muted-foreground">{p.code}</div>
                      </td>
                      <td>
                        <Badge variant="outline" className="font-mono text-xs">{p.role}</Badge>
                      </td>
                      <td>
                        <div className="flex items-center gap-1 text-xs">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{p._count.users}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1 text-xs font-semibold">
                          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{p._count.permissions}</span>
                        </div>
                      </td>
                      <td>
                        {p.system ? (
                          <Badge className="bg-status-red/10 text-status-red border-transparent hover:bg-status-red/15 text-[10px]">Sistema</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Personalizado</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Resumo Estatístico */}
          <div className="space-y-4 lg:col-span-1">
            <SectionCard title="Módulos de Permissão" description={`${data.totalPermissions} chaves ativas.`}>
              <div className="space-y-2 py-1">
                {data.permissionModules.map((m) => (
                  <div key={m.module} className="flex justify-between items-center text-xs border-b border-border/50 pb-1.5">
                    <span className="font-mono font-semibold">{m.module}</span>
                    <Badge variant="secondary">{m.count} chaves</Badge>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Usuários por Papel" description="Distribuição de papéis do sistema.">
              <div className="space-y-2 py-1">
                {data.usersByRole.map((u) => (
                  <div key={u.role} className="flex justify-between items-center text-xs border-b border-border/50 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-semibold text-xs">{u.role}</span>
                    </div>
                    <Badge className="bg-foreground text-background">{u.count} usuário(s)</Badge>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
}
