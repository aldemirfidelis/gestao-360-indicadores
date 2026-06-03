'use client';

import { cn } from '@/lib/utils';
import { PRESENCE_DOT, PRESENCE_LABEL, type PresenceStatus } from '@/lib/communication/events';

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');
}

const SIZES: Record<string, string> = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl',
};

export function PresenceDot({ status, className }: { status: PresenceStatus; className?: string }) {
  return (
    <span
      title={PRESENCE_LABEL[status]}
      className={cn('inline-block rounded-full ring-2 ring-background', PRESENCE_DOT[status], className)}
    />
  );
}

export function UserAvatar({
  name,
  avatarUrl,
  size = 'md',
  status,
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: keyof typeof SIZES | 'sm' | 'md' | 'lg' | 'xl';
  status?: PresenceStatus;
  className?: string;
}) {
  const sizeCls = SIZES[size] ?? SIZES.md;
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name}
          className={cn('rounded-full object-cover', sizeCls)}
        />
      ) : (
        <span
          className={cn(
            'grid place-items-center rounded-full bg-foreground font-semibold text-background',
            sizeCls,
          )}
        >
          {initials(name)}
        </span>
      )}
      {status && (
        <PresenceDot
          status={status}
          className={cn(
            'absolute -bottom-0.5 -right-0.5',
            size === 'lg' || size === 'xl' ? 'h-4 w-4' : 'h-3 w-3',
          )}
        />
      )}
    </span>
  );
}
