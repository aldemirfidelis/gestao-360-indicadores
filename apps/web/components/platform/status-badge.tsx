import { AlertCircle, CheckCircle2, Circle, Clock3, PauseCircle, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'purple';

const toneClass: Record<Tone, string> = {
  green: 'bg-status-green/10 text-status-green border-status-green/25',
  yellow: 'bg-status-yellow/10 text-status-yellow border-status-yellow/25',
  red: 'bg-status-red/10 text-status-red border-status-red/25',
  gray: 'bg-status-gray/10 text-muted-foreground border-status-gray/25',
  blue: 'bg-status-blue/10 text-status-blue border-status-blue/25',
  purple: 'bg-status-purple/10 text-status-purple border-status-purple/25',
};

const statusTone: Record<string, Tone> = {
  GREEN: 'green',
  YELLOW: 'yellow',
  RED: 'red',
  GRAY: 'gray',
  BLUE: 'blue',
  ACTIVE: 'green',
  IN_PROGRESS: 'blue',
  IN_ANALYSIS: 'blue',
  WAITING_ACTION: 'yellow',
  WAITING_THIRD: 'yellow',
  PAUSED: 'yellow',
  OPEN: 'red',
  CRITICAL: 'red',
  HIGH: 'red',
  MODERATE: 'yellow',
  MEDIUM: 'yellow',
  LOW: 'blue',
  DONE: 'green',
  DONE_LATE: 'yellow',
  CLOSED: 'green',
  CLOSED_LATE: 'yellow',
  NOT_STARTED: 'gray',
  CANCELLED: 'gray',
  PLANNED: 'gray',
  ON_HOLD: 'yellow',
};

const statusIcon: Record<Tone, typeof Circle> = {
  green: CheckCircle2,
  yellow: Clock3,
  red: AlertCircle,
  gray: Circle,
  blue: PlayCircle,
  purple: PauseCircle,
};

export function statusToneFor(value: string | null | undefined): Tone {
  if (!value) return 'gray';
  return statusTone[value] ?? 'gray';
}

export function StatusBadge({
  value,
  label,
  tone,
  className,
}: {
  value?: string | null;
  label?: string;
  tone?: Tone;
  className?: string;
}) {
  const finalTone = tone ?? statusToneFor(value);
  const Icon = statusIcon[finalTone];

  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 border px-2 text-[11px] font-medium uppercase tracking-wide',
        toneClass[finalTone],
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {label ?? value ?? 'Sem status'}
    </span>
  );
}
