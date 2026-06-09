'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Trophy, FileSignature, CalendarDays, Target, CheckCircle2, AlertTriangle, Users, Calculator } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

interface Overview {
  cards: {
    programsActive: number;
    competencesFilling: number;
    competencesValidation: number;
    competencesClosed: number;
    annexesPendingApproval: number;
    annexesEffective: number;
    indicators: number;
    eligibleEmployees: number;
    divergences: number;
    calculationsProcessed: number;
    payrollBatches: number;
    payslipsPublished: number;
  };
  recentActivity: Array<{ id: string; action: string; entityType: string; userEmail: string | null; createdAt: string }>;
}

const ACTION_LABEL: Record<string, string> = {
  CREATE: 'criou', UPDATE: 'editou', SUBMIT: 'enviou p/ validação', SEND_APPROVAL: 'enviou p/ aprovação',
  APPROVE: 'aprovou', REJECT: 'reprovou', RETURN: 'devolveu', PUBLISH: 'publicou (vigente)',
  CLOSE: 'fechou', REOPEN: 'reabriu', TRANSITION: 'mudou status', NEW_VERSION: 'criou versão',
  DUPLICATE: 'duplicou', STATUS: 'mudou status', SET_PARAMETER: 'definiu meta/zero', SET_RANGE: 'definiu faixa',
};
const ENTITY_LABEL: Record<string, string> = {
  PROGRAM: 'programa', COMPETENCE: 'competência', ANNEX: 'anexo', ANNEX_VERSION: 'versão de anexo',
  INDICATOR: 'indicador', PARAMETER: 'parâmetro', RANGE: 'faixa',
};

function StatCard({ icon: Icon, label, value, tone = 'default', href }: { icon: any; label: string; value: number; tone?: string; href?: string }) {
  const body = (
    <Card className="h-full transition-shadow hover:shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-semibold leading-none">{value}</div>
          <div className="truncate text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function PrizeOverviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['prize-overview'],
    queryFn: () => api<Overview>('/prize/overview'),
  });

  const c = data?.cards;

  return (
    <div>
      <PageHeader
        title="Gestão de Prêmio"
        eyebrow="Remuneração Variável"
        description="Painel executivo do ciclo do prêmio: anexos, competências, indicadores e apuração."
        tone="view"
        breadcrumbs={[{ label: 'Gestão de Prêmio' }]}
      />

      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Carregando painel…</div>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Governança e ciclo</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              <StatCard icon={Trophy} label="Programas ativos" value={c?.programsActive ?? 0} tone="bg-amber-100 text-amber-700" href="/gestao-premio/programas" />
              <StatCard icon={FileSignature} label="Anexos aguardando aprovação" value={c?.annexesPendingApproval ?? 0} tone="bg-orange-100 text-orange-700" href="/gestao-premio/anexos" />
              <StatCard icon={CheckCircle2} label="Anexos vigentes" value={c?.annexesEffective ?? 0} tone="bg-emerald-100 text-emerald-700" href="/gestao-premio/anexos" />
              <StatCard icon={Target} label="Indicadores" value={c?.indicators ?? 0} tone="bg-sky-100 text-sky-700" href="/gestao-premio/indicadores" />
              <StatCard icon={CalendarDays} label="Competências em preenchimento" value={c?.competencesFilling ?? 0} tone="bg-blue-100 text-blue-700" href="/gestao-premio/competencias" />
              <StatCard icon={CalendarDays} label="Competências em validação" value={c?.competencesValidation ?? 0} tone="bg-indigo-100 text-indigo-700" href="/gestao-premio/competencias" />
              <StatCard icon={CalendarDays} label="Competências fechadas" value={c?.competencesClosed ?? 0} tone="bg-slate-100 text-slate-700" href="/gestao-premio/competencias" />
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">
              Apuração e folha <span className="ml-1 text-xs font-normal text-muted-foreground/70">(disponível nas próximas fases)</span>
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              <StatCard icon={Users} label="Colaboradores elegíveis" value={c?.eligibleEmployees ?? 0} tone="bg-muted text-muted-foreground" />
              <StatCard icon={AlertTriangle} label="Divergências" value={c?.divergences ?? 0} tone="bg-muted text-muted-foreground" />
              <StatCard icon={Calculator} label="Cálculos processados" value={c?.calculationsProcessed ?? 0} tone="bg-muted text-muted-foreground" />
              <StatCard icon={Users} label="Lotes para folha" value={c?.payrollBatches ?? 0} tone="bg-muted text-muted-foreground" />
              <StatCard icon={FileSignature} label="Espelhos publicados" value={c?.payslipsPublished ?? 0} tone="bg-muted text-muted-foreground" />
            </div>
          </div>

          <Card>
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-medium">Atividade recente (trilha de auditoria)</h2>
              {data?.recentActivity?.length ? (
                <ul className="divide-y divide-border/60">
                  {data.recentActivity.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{a.userEmail ?? 'Sistema'}</span>{' '}
                        {ACTION_LABEL[a.action] ?? a.action.toLowerCase()}{' '}
                        <Badge variant="secondary">{ENTITY_LABEL[a.entityType] ?? a.entityType}</Badge>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(a.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
