'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import {
  History,
  Search,
  User,
  PlusCircle,
  CheckCircle,
  FileEdit,
  GitPullRequest,
  Archive,
  Sliders,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuditLog {
  id: string;
  workflowName: string;
  versionNumber: number | null;
  action: 'CREATE' | 'UPDATE' | 'PUBLISH' | 'ARCHIVE' | 'DUPLICATE';
  actorName: string;
  changeSummary: string;
  createdAt: string;
}

export default function AuditHistoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');

  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ['automations', 'history'],
    queryFn: () => api('/automations/history'),
  });

  const getActionBadge = (action: AuditLog['action']) => {
    switch (action) {
      case 'CREATE':
        return { label: 'Criado', icon: PlusCircle, className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
      case 'UPDATE':
        return { label: 'Editado', icon: FileEdit, className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
      case 'PUBLISH':
        return { label: 'Publicado', icon: CheckCircle, className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
      case 'ARCHIVE':
        return { label: 'Arquivado', icon: Archive, className: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };
      case 'DUPLICATE':
        return { label: 'Duplicado', icon: GitPullRequest, className: 'bg-purple-500/10 text-purple-500 border-purple-500/20' };
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesAction = selectedAction === 'ALL' ? true : log.action === selectedAction;
    const matchesSearch =
      log.workflowName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.changeSummary.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesAction && matchesSearch;
  });

  const actions = ['ALL', 'CREATE', 'UPDATE', 'PUBLISH', 'ARCHIVE', 'DUPLICATE'];

  return (
    <div className="p-6 space-y-6 flex-1 flex flex-col min-h-0">
      <PageHeader
        eyebrow="Central de Automações"
        title="Histórico de Alterações"
        description="Rastreie o histórico completo de design e configurações operadas por administradores nos fluxos da sua empresa."
      />

      {/* Main panel */}
      <div className="flex-1 flex flex-col border bg-card rounded-xl overflow-hidden min-h-0">
        {/* Filters bar */}
        <div className="p-4 border-b bg-muted/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {actions.map((act) => (
              <Button
                key={act}
                variant={selectedAction === act ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs px-2.5"
                onClick={() => setSelectedAction(act)}
              >
                {act === 'ALL' ? 'Todos' : act}
              </Button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar histórico..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border rounded-lg focus:outline-none"
            />
          </div>
        </div>

        {/* Timeline list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="space-y-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl border bg-muted/30" />)}</div>
          ) : filteredLogs.length > 0 ? (
            <div className="relative border-l border-muted pl-6 ml-2 space-y-6">
              {filteredLogs.map((log) => {
                const badge = getActionBadge(log.action);
                const Icon = badge.icon;
                return (
                  <div key={log.id} className="relative">
                    {/* Circle icon on the timeline line */}
                    <div className="absolute -left-[31px] top-0.5 bg-background border p-1 rounded-full text-foreground shadow-sm">
                      <Icon className="h-3.5 w-3.5" />
                    </div>

                    <div className="bg-card border rounded-xl p-4 space-y-2 hover:border-primary/20 hover:shadow-sm transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-foreground leading-tight">
                            {log.workflowName}
                          </h4>
                          {log.versionNumber && (
                            <span className="text-[10px] text-muted-foreground">Versão: v{log.versionNumber}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={cn('text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border', badge.className)}>
                            {badge.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {log.changeSummary}
                      </p>

                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-1.5 border-t">
                        <User className="h-3.5 w-3.5 opacity-70" />
                        <span>Por: <strong className="text-foreground">{log.actorName}</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-xs text-muted-foreground border border-dashed rounded-xl">
              <History className="h-8 w-8 opacity-40 mb-2" />
              <span>Nenhum log de auditoria encontrado correspondente aos filtros.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
