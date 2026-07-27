'use client';

import { ArrowRight, BriefcaseBusiness, CheckCircle2, ChevronRight, FileText, HandCoins, Info, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import type { NextStep, NextStepTone } from '@/lib/candidate/progress';
import { nextSteps, portalCounters, profileCompletion } from '@/lib/candidate/progress';
import type { PortalData } from '@/lib/candidate/types';
import { APPLICATION_STATUS, status } from '@/lib/candidate/labels';
import type { PortalTab } from './tabs';
import { Button, Card, CardTitle, EmptyState, Pill, ProgressRing, formatDate } from './ui';

const TONE_STYLE: Record<NextStepTone, { wrap: string; icon: typeof Info }> = {
  action: { wrap: 'border-sky-200 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/25', icon: ArrowRight },
  warning: { wrap: 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/25', icon: TriangleAlert },
  info: { wrap: 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60', icon: Info },
};

/**
 * Tela inicial: responde "o que preciso fazer agora?".
 *
 * Antes o candidato caía num painel com seis blocos abertos e nenhuma
 * hierarquia. Aqui as pendências vêm primeiro e cada uma leva à aba que a
 * resolve.
 */
export function OverviewSection({
  data,
  onNavigate,
  vacanciesHref,
}: {
  data: PortalData;
  onNavigate: (tab: PortalTab) => void;
  vacanciesHref: string;
}) {
  const steps = nextSteps(data);
  const counters = portalCounters(data);
  const completion = profileCompletion(data.profile);
  const recent = [...data.applications].sort((a, b) => (b.appliedAt ?? '').localeCompare(a.appliedAt ?? '')).slice(0, 3);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle
            title={steps.length > 0 ? 'Seus próximos passos' : 'Tudo em dia'}
            hint={steps.length > 0 ? 'Resolvemos em ordem de urgência.' : 'Nenhuma pendência sua no momento.'}
          />
          {steps.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-8 w-8" />}
              title="Nada pendente por aqui"
              description="Quando uma empresa pedir um documento ou enviar uma proposta, o aviso aparece nesta tela."
              action={
                <Link href={vacanciesHref}>
                  <Button variant="secondary" size="sm">Ver vagas abertas</Button>
                </Link>
              }
            />
          ) : (
            <ul className="space-y-2.5">
              {steps.map((step) => (
                <StepRow key={step.id} step={step} onClick={() => onNavigate(step.target)} />
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle title="Seu perfil" />
          <div className="flex items-center gap-4">
            <ProgressRing percent={completion.percent} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{data.profile?.name ?? '—'}</p>
              <p className="truncate text-sm text-slate-500 dark:text-slate-400">{data.profile?.email ?? ''}</p>
              <p className="mt-1 text-xs text-slate-400">
                {completion.filled} de {completion.total} campos preenchidos
              </p>
            </div>
          </div>
          {completion.missing.length > 0 && (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Um perfil completo aparece melhor na triagem. Falta: <span className="font-medium text-slate-700 dark:text-slate-200">{completion.missing.slice(0, 3).join(', ')}</span>.
            </p>
          )}
          <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={() => onNavigate('perfil')}>
            {completion.percent === 100 ? 'Revisar perfil' : 'Completar perfil'}
          </Button>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={BriefcaseBusiness} label="Candidaturas ativas" value={counters.activeApplications} onClick={() => onNavigate('candidaturas')} />
        <StatCard icon={HandCoins} label="Propostas a responder" value={counters.openOffers} highlight={counters.openOffers > 0} onClick={() => onNavigate('candidaturas')} />
        <StatCard icon={FileText} label="Documentos enviados" value={counters.documentsCount} onClick={() => onNavigate('documentos')} />
      </div>

      <Card>
        <CardTitle
          title="Candidaturas recentes"
          action={
            data.applications.length > 0 ? (
              <button onClick={() => onNavigate('candidaturas')} className="inline-flex items-center gap-1 text-sm font-semibold text-sky-600 hover:underline dark:text-sky-400">
                Ver todas <ChevronRight className="h-4 w-4" />
              </button>
            ) : undefined
          }
        />
        {recent.length === 0 ? (
          <EmptyState
            icon={<BriefcaseBusiness className="h-8 w-8" />}
            title="Você ainda não se candidatou"
            description="Suas candidaturas e o andamento de cada uma aparecem aqui."
            action={
              <Link href={vacanciesHref}>
                <Button size="sm">Explorar vagas</Button>
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {recent.map((app) => {
              const badge = status(APPLICATION_STATUS, app.status);
              return (
                <li key={app.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{app.posting.title}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {[app.posting.company?.name, app.stage, `Inscrição em ${formatDate(app.appliedAt)}`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Pill label={badge.label} tone={badge.tone} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StepRow({ step, onClick }: { step: NextStep; onClick: () => void }) {
  const tone = TONE_STYLE[step.tone];
  const Icon = tone.icon;
  return (
    <li>
      <button
        onClick={onClick}
        className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition hover:brightness-[0.98] ${tone.wrap}`}
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{step.title}</p>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{step.description}</p>
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      </button>
    </li>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  highlight,
  onClick,
}: {
  icon: typeof BriefcaseBusiness;
  label: string;
  value: number;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md dark:bg-slate-900 ${
        highlight ? 'border-amber-300 dark:border-amber-800' : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${highlight ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-2xl font-bold leading-none text-slate-900 dark:text-slate-50">{value}</p>
        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </button>
  );
}
