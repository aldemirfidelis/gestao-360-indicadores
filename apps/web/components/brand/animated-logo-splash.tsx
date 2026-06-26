'use client';

import { cn } from '@/lib/utils';
import { BrandLogo } from './brand-logo';

interface AnimatedLogoSplashProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function AnimatedLogoSplash({ className, size = 'lg' }: AnimatedLogoSplashProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 bg-gradient-to-br from-[#0f2042] to-[#081023] rounded-[32px] shadow-2xl border border-slate-800/40 relative overflow-hidden group',
        className
      )}
    >
      {/* Background soft pulsing glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.08)_0%,transparent_70%)] animate-pulse" />
      
      <div className="relative z-10 flex flex-col items-center gap-6">
        <BrandLogo
          variant="icon"
          size={size}
          animated={true}
          className="w-28 h-28 md:w-36 md:h-36 drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:scale-105"
        />
        <div className="text-center">
          <h1 className="text-lg font-bold text-white tracking-wider font-sans uppercase">
            Gestão <span className="text-[#00F0FF]">360</span>
          </h1>
          <p className="text-xs text-slate-400 font-semibold tracking-[0.25em] uppercase mt-1">
            Gestão Empresarial
          </p>
        </div>
      </div>
    </div>
  );
}
