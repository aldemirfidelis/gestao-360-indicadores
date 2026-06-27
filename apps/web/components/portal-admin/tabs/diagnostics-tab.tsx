'use client';

import type { ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Info, RefreshCcw, ShieldAlert } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

interface Finding { id: string; level: string; category: string; title: string; description: string; suggestion?: string }
interface Report { generatedAt: string; summary: Record<string, number>; findings: Finding[] }

const ICON: Record<string, ReactElement> = {
  critical: <ShieldAlert className="h-4 w-4 text-status-red" />,
  high: <ShieldAlert className="h-4 w-4 text-status-red" />,
  risk: <AlertTriangle className="h-4 w-4 text-status-yellow" />,
  warning: <AlertTriangle className="h-4 w-4 text-status-yellow" />,
  info: <Info className="h-4 w-4 text-status-blue" />,
};

export function DiagnosticsTab() {
  const q = useQuery<Report>({ queryKey: ['portal', 'diagnostics'], queryFn: () => api('/admin/portal/diagnostics'), refetchOnWindowFocus: false });
  const d = q.data;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Verificações read-only do portal. Correções não são aplicadas automaticamente.</p>
        <Button onClick={() => q.refetch()} disabled={q.isFetching}><RefreshCcw className={cn('mr-2 h-4 w-4', q.isFetching && 'animate-spin')} />Executar diagnóstico</Button>
      </div>
      {q.isLoading && <LoadingState label="Analisando o portal..." />}
      {d && (
        <SectionCard title="Achados" description={`${d.findings.length} item(ns) · gerado em ${formatDate(d.generatedAt)}`} contentClassName={d.findings.length ? 'p-0' : ''}>
          {d.findings.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-status-green/30 bg-status-green/10 p-4 text-sm"><CheckCircle2 className="h-4 w-4 text-status-green" />Nenhum problema detectado.</div>
          ) : (
            <div className="divide-y">
              {d.findings.map((f) => (
                <div key={f.id} className="flex items-start gap-3 p-4">
                  <div className="mt-0.5">{ICON[f.level] ?? ICON.info}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{f.title}</span><Badge variant="outline">{f.category}</Badge></div>
                    <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>
                    {f.suggestion && <p className="mt-1 text-xs text-foreground">💡 {f.suggestion}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
