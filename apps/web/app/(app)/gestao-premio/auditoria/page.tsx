'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';

interface AuditRow { id: string; action: string; entityType: string; entityId: string; userEmail: string | null; justification: string | null; createdAt: string }

const ENTITY_TYPES = ['', 'PROGRAM', 'COMPETENCE', 'ANNEX', 'ANNEX_VERSION', 'INDICATOR', 'ACTUAL', 'ELIGIBLE_BATCH', 'CALC_RUN', 'MODERATOR_RULE', 'ADJUSTMENT', 'EXCEPTION', 'PAYROLL_BATCH', 'PAYSLIP'];
const ENTITY_LABEL: Record<string, string> = {
  PROGRAM: 'Programa', COMPETENCE: 'Competência', ANNEX: 'Anexo', ANNEX_VERSION: 'Versão de anexo', INDICATOR: 'Indicador',
  ACTUAL: 'Realizado', ELIGIBLE_BATCH: 'Base elegível', CALC_RUN: 'Apuração', MODERATOR_RULE: 'Moderador', ADJUSTMENT: 'Ajuste',
  EXCEPTION: 'Exceção', PAYROLL_BATCH: 'Lote folha', PAYSLIP: 'Espelho', ALLOCATION: 'Transitoriedade', CONNECTOR: 'Conector',
};
const ACTION_LABEL: Record<string, string> = {
  CREATE: 'criou', UPDATE: 'editou', DELETE: 'excluiu', SUBMIT: 'enviou', APPROVE: 'aprovou', REJECT: 'reprovou', RETURN: 'devolveu',
  PUBLISH: 'publicou', CLOSE: 'fechou', REOPEN: 'reabriu', CALC_RUN: 'apurou', GENERATE: 'gerou', SENT: 'enviou à folha',
  RETURN_PAYROLL: 'conciliou retorno', ACKNOWLEDGE: 'deu ciência', IMPORT_ELIGIBLE: 'importou base', SET_ELIGIBILITY: 'ajustou elegibilidade',
  SUBMIT_REVIEW: 'enviou p/ conferência', CANCEL: 'cancelou', TRANSITION: 'mudou status',
};

export default function PrizeAuditPage() {
  const [entityType, setEntityType] = useState('');
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['prize-audit', entityType],
    queryFn: () => api<AuditRow[]>(`/prize/audit${entityType ? `?entityType=${entityType}` : ''}`),
  });

  return (
    <div>
      <PageHeader
        title="Auditoria do Prêmio"
        eyebrow="Gestão de Prêmio"
        description="Trilha imutável de todas as ações críticas: quem, o quê, quando e por quê."
        tone="view"
        breadcrumbs={[{ label: 'Gestão de Prêmio', href: '/gestao-premio' }, { label: 'Auditoria' }]}
      />

      <div className="mb-4 flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Entidade:</Label>
        <NativeSelect value={entityType} onChange={(e) => setEntityType(e.target.value)} className="max-w-xs">
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t ? ENTITY_LABEL[t] ?? t : 'Todas'}</option>)}
        </NativeSelect>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <ShieldCheck className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Nenhum registro de auditoria.</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/60">
              {rows.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 px-4 py-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium">{a.userEmail ?? 'Sistema'}</span>{' '}
                    {ACTION_LABEL[a.action] ?? a.action.toLowerCase()}{' '}
                    <Badge variant="secondary">{ENTITY_LABEL[a.entityType] ?? a.entityType}</Badge>
                    {a.justification && <span className="block text-xs text-muted-foreground">“{a.justification}”</span>}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString('pt-BR')}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
