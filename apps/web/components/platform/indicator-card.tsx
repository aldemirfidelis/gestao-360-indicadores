import Link from 'next/link';
import { CalendarClock, Target, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { StatusLight } from '@/components/ui/status-light';
import { formatNumber, formatPercent, periodRefLabel } from '@/lib/utils';
import { INDICATOR_TYPE_LABEL, PERIODICITY_LABEL } from '@/lib/labels';

export interface IndicatorCardData {
  id: string;
  name: string;
  code: string | null;
  type: string;
  periodicity: string;
  unit: string;
  unitLabel: string | null;
  ownerNode: { id: string; name: string; type?: string };
  responsibleUser: { id: string; name: string } | null;
  last: {
    periodRef: string;
    value: number;
    light: string;
    attainment: number | null;
    deviationPct: number | null;
  } | null;
}

export function IndicatorCard({ indicator }: { indicator: IndicatorCardData }) {
  const attainment = indicator.last?.attainment ? Math.min(100, Math.round(indicator.last.attainment * 100)) : 0;

  return (
    <Link href={`/indicators/${indicator.id}`} className="block">
      <article className="panel panel-hover h-full p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {indicator.code && <Badge variant="outline">{indicator.code}</Badge>}
              <Badge variant="secondary">{INDICATOR_TYPE_LABEL[indicator.type] ?? indicator.type}</Badge>
            </div>
            <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">{indicator.name}</h3>
          </div>
          <StatusLight light={indicator.last?.light ?? 'GRAY'} size="md" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground">Realizado</div>
            <div className="text-base font-semibold">
              {indicator.last ? formatNumber(indicator.last.value) : '-'}
              <span className="ml-1 text-xs font-normal text-muted-foreground">{indicator.unitLabel ?? ''}</span>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Atingimento</div>
            <div className="text-base font-semibold">{formatPercent(indicator.last?.attainment ?? null)}</div>
          </div>
        </div>

        <Progress value={attainment} className="mt-3 h-1.5" />

        <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Target className="h-3.5 w-3.5" />
            <span className="truncate">{indicator.ownerNode.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <UserRound className="h-3.5 w-3.5" />
            <span className="truncate">{indicator.responsibleUser?.name ?? 'Sem responsável'}</span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarClock className="h-3.5 w-3.5" />
            <span>{indicator.last ? periodRefLabel(indicator.last.periodRef) : (PERIODICITY_LABEL[indicator.periodicity] ?? indicator.periodicity)}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
