'use client';

import { cn } from '@/lib/utils';

import { useEffect, useState } from 'react';

export function BrandMark({ className }: { className?: string }) {
  const [rotation, setRotation] = useState(0);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    // Only execute on the client side
    if (typeof window !== 'undefined') {
      const hasAnimated = sessionStorage.getItem('gestao360_logo_animated');
      if (!hasAnimated) {
        sessionStorage.setItem('gestao360_logo_animated', 'true');
        setShouldAnimate(true);
        const timer = setTimeout(() => {
          setRotation(360);
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  return (
    <div
      className={cn(
        'relative grid place-items-center overflow-hidden bg-foreground text-background',
        className,
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 48 48"
        className="relative h-[70%] w-[70%]"
        focusable="false"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: shouldAnimate ? 'transform 1.6s cubic-bezier(0.25, 1.25, 0.5, 1)' : 'none',
        }}
      >
        {/* Main white loop */}
        <path
          d="M32 35 A 15 15 0 1 1 24 9"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="3.5"
        />
        {/* Cyan loop segment */}
        <path
          d="M24 9 A 15 15 0 0 1 35 15"
          fill="none"
          stroke="#4ED7FA"
          strokeLinecap="round"
          strokeWidth="3.5"
        />
        {/* Cyan right-angle arrow tip */}
        <path
          d="M35 10 L35 16 L29 16"
          fill="none"
          stroke="#4ED7FA"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3.5"
        />
        {/* Centered avatar (head and rounded shoulders) */}
        <circle cx="24" cy="20.5" r="3.5" fill="currentColor" />
        <rect x="15" y="26.5" width="18" height="3.5" rx="1.75" fill="currentColor" />
      </svg>
    </div>
  );
}

export function BrandLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <BrandMark className="h-8 w-8 shrink-0" />
      {!compact && (
        <div className="min-w-0 leading-tight">
          <div className="text-sm font-semibold tracking-tight">Gestão 360</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Suíte de gestão</div>
        </div>
      )}
    </div>
  );
}
