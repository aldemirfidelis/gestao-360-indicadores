import { cn } from '@/lib/utils';

type Light = 'GREEN' | 'YELLOW' | 'RED' | 'GRAY' | string;

interface Props {
  light: Light;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const map: Record<string, { pill: string; dot: string; label: string }> = {
  GREEN: { pill: 'pill-green', dot: 'bg-status-green', label: 'No alvo' },
  YELLOW: { pill: 'pill-yellow', dot: 'bg-status-yellow', label: 'Atenção' },
  RED: { pill: 'pill-red', dot: 'bg-status-red', label: 'Crítico' },
  GRAY: { pill: 'pill-gray', dot: 'bg-status-gray', label: 'Sem dados' },
};

export function StatusLight({ light, label, size = 'sm', className }: Props) {
  const cfg = map[light] ?? map.GRAY;
  return (
    <span className={cn('pill', cfg.pill, size === 'md' && 'text-sm px-3 py-1', className)}>
      <span className={cn('inline-block rounded-full', cfg.dot, size === 'md' ? 'h-2.5 w-2.5' : 'h-2 w-2')} />
      {label ?? cfg.label}
    </span>
  );
}
