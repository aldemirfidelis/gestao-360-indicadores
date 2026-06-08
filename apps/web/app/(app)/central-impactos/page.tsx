'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ShieldAlert, CheckCircle2, Clock, AlertTriangle, Filter, X, Eye, RefreshCw
} from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { useVision360 } from '@/components/ui/vision360-context';
import { cn, formatDate } from '@/lib/utils';

interface PendingImpact {
  id: string;
  impactAnalysisId: string;
  sourceType: string;
  sourceId: string;
  operation: string;
  changeSummary: string;
  affectedType: string;
  affectedId: string;
  relationshipPath: string;
  reason: string;
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  responsible: string;
  responsibleId: string | null;
  dueDate: string | null;
  createdAt: string;
  createdBy: string;
}

export default function CentralImpactosPage() {
  const qc = useQueryClient();
  const { open: openVision360 } = useVision360();
  const [filters, setFilters] = useState({ search: '', type: '', criticality: '' });

  // Query pendencias
  const { data: impacts, isLoading, refetch } = useQuery<PendingImpact[]>({
    queryKey: ['pending-impacts'],
    queryFn: () => api<PendingImpact[]>('/vision360/pending-impacts'),
  });

  // Mutation para resolver
  const resolveMutation = useMutation({
    mutationFn: (id: string) => api(`/vision360/impact-items/${id}/resolve`, { method: 'PATCH' }),
    onSuccess: () => {
      toast.success('Pendente marcado como resolvido!');
      qc.invalidateQueries({ queryKey: ['pending-impacts'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao resolver pendência');
    }
  });

  // Filtros aplicados em memoria
  const filteredImpacts = useMemo(() => {
    if (!impacts) return [];
    return impacts.filter((imp) => {
      const matchesSearch =
        imp.changeSummary.toLowerCase().includes(filters.search.toLowerCase()) ||
        imp.reason.toLowerCase().includes(filters.search.toLowerCase()) ||
        imp.responsible.toLowerCase().includes(filters.search.toLowerCase());

      if (!matchesSearch) return false;

      if (filters.type && imp.affectedType !== filters.type) return false;
      if (filters.criticality && imp.criticality !== filters.criticality) return false;

      return true;
    });
  }, [impacts, filters]);

  // Contadores para cards
  const stats = useMemo(() => {
    if (!impacts) return { total: 0, critical: 0, expired: 0, pendingReview: 0 };
    const now = Date.now();
    return {
      total: impacts.length,
      critical: impacts.filter(i => i.criticality === 'CRITICAL' || i.criticality === 'HIGH').length,
      expired: impacts.filter(i => i.dueDate && new Date(i.dueDate).getTime() < now).length,
      pendingReview: impacts.filter(i => i.dueDate && new Date(i.dueDate).getTime() >= now).length,
    };
  }, [impacts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Impactos"
        description="Painel operacional para acompanhamento e resolução de impactos decorrentes de alterações no sistema."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading} className="gap-1">
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        }
      />

      {/* Cards de Métricas */}
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard
          title="Total Pendentes"
          value={stats.total}
          description="Aguardando adequação"
          icon={<Clock className="h-4 w-4" />}
          tone="blue"
        />
        <MetricCard
          title="Impactos Críticos"
          value={stats.critical}
          description="Risco alto ou crítico"
          icon={<ShieldAlert className="h-4 w-4" />}
          tone={stats.critical > 0 ? 'red' : 'green'}
        />
        <MetricCard
          title="Tarefas Atrasadas"
          value={stats.expired}
          description="Prazo de adequação vencido"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={stats.expired > 0 ? 'red' : 'green'}
        />
        <MetricCard
          title="Em Prazo"
          value={stats.pendingReview}
          description="Adequação em andamento"
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="green"
        />
      </div>

      {/* Bloco de Filtros */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-end">
          <div className="grid flex-1 gap-2">
            <Label>Buscar</Label>
            <Input
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              placeholder="Alteração, motivo do impacto ou responsável..."
              className="h-9"
            />
          </div>
          <div className="grid gap-2 md:w-48">
            <Label>Tipo de Registro Afetado</Label>
            <NativeSelect
              value={filters.type}
              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
            >
              <option value="">Todos os tipos</option>
              <option value="INDICATOR">Indicador</option>
              <option value="PROCESS">Processo</option>
              <option value="DOCUMENT">Documento</option>
              <option value="RISK">Risco</option>
              <option value="NON_CONFORMITY">Não Conformidade</option>
              <option value="ACTION_PLAN">Plano de Ação</option>
              <option value="MEETING">Reunião</option>
              <option value="PROJECT">Projeto</option>
              <option value="DEVIATION">Desvio</option>
              <option value="AUDIT">Auditoria</option>
            </NativeSelect>
          </div>
          <div className="grid gap-2 md:w-48">
            <Label>Criticidade</Label>
            <NativeSelect
              value={filters.criticality}
              onChange={(e) => setFilters(prev => ({ ...prev, criticality: e.target.value }))}
            >
              <option value="">Todas</option>
              <option value="CRITICAL">Crítico</option>
              <option value="HIGH">Alto</option>
              <option value="MEDIUM">Médio</option>
              <option value="LOW">Baixo</option>
              <option value="INFO">Informativo</option>
            </NativeSelect>
          </div>
          <Button
            variant="outline"
            className="h-9"
            onClick={() => setFilters({ search: '', type: '', criticality: '' })}
          >
            <X className="mr-2 h-4 w-4" /> Limpar
          </Button>
        </CardContent>
      </Card>

      {/* Tabela Operacional */}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[1000px] text-sm text-left">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Registro Afetado</th>
                <th className="px-4 py-3 font-medium">Origem do Impacto</th>
                <th className="px-4 py-3 font-medium">Criticidade</th>
                <th className="px-4 py-3 font-medium">Caminho / Motivo</th>
                <th className="px-4 py-3 font-medium">Responsável</th>
                <th className="px-4 py-3 font-medium">Prazo Adequação</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground animate-pulse">
                    Carregando pendências de impactos...
                  </td>
                </tr>
              )}
              {!isLoading && filteredImpacts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum impacto pendente encontrado.
                  </td>
                </tr>
              )}
              {filteredImpacts.map((imp) => {
                const isOverdue = imp.dueDate && new Date(imp.dueDate).getTime() < Date.now();
                return (
                  <tr key={imp.id} className="border-b last:border-0 hover:bg-muted/10">
                    {/* Registro Afetado */}
                    <td className="px-4 py-3 min-w-[200px]">
                      <div className="flex flex-col">
                        <button
                          onClick={() => openVision360(imp.affectedType, imp.affectedId)}
                          className="font-semibold text-primary hover:underline text-left truncate max-w-[240px]"
                        >
                          {imp.affectedType} ({imp.affectedId.slice(0, 8)})
                        </button>
                        <span className="text-[10px] text-muted-foreground">Criado por: {imp.createdBy}</span>
                      </div>
                    </td>

                    {/* Origem da Alteracao */}
                    <td className="px-4 py-3 max-w-[260px]">
                      <div className="flex flex-col">
                        <span className="font-medium truncate" title={imp.changeSummary}>{imp.changeSummary}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{imp.operation} em {imp.sourceType}</span>
                      </div>
                    </td>

                    {/* Criticidade */}
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-[10px] uppercase font-semibold ${
                        imp.criticality === 'CRITICAL' ? 'border-rose-400 text-rose-600 bg-rose-50/50' :
                        imp.criticality === 'HIGH' ? 'border-amber-400 text-amber-600 bg-amber-50/50' :
                        'border-border text-muted-foreground'
                      }`}>
                        {imp.criticality}
                      </Badge>
                    </td>

                    {/* Caminho / Motivo */}
                    <td className="px-4 py-3 max-w-[300px]">
                      <div className="flex flex-col text-xs">
                        <span className="font-mono text-primary truncate" title={imp.relationshipPath}>{imp.relationshipPath}</span>
                        <span className="text-muted-foreground truncate mt-0.5" title={imp.reason}>{imp.reason}</span>
                      </div>
                    </td>

                    {/* Responsável */}
                    <td className="px-4 py-3">
                      <span className="font-medium">{imp.responsible}</span>
                    </td>

                    {/* Prazo */}
                    <td className="px-4 py-3">
                      {imp.dueDate ? (
                        <span className={cn('font-semibold', isOverdue && 'text-rose-600')}>
                          {formatDate(imp.dueDate)}
                          {isOverdue && <span className="block text-[9px] font-bold uppercase text-rose-600">Vencido</span>}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Sem prazo</span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => openVision360(imp.affectedType, imp.affectedId)}
                        >
                          <Eye className="h-3.5 w-3.5" /> 360°
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-status-green hover:text-status-green hover:bg-status-green/10 border-status-green/20"
                          onClick={() => resolveMutation.mutate(imp.id)}
                          disabled={resolveMutation.isPending}
                        >
                          Resolver
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
