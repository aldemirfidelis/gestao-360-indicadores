'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  variant?: 'horizontal' | 'vertical' | 'icon';
  theme?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
}

export function BrandLogo({
  variant = 'horizontal',
  theme = 'light',
  size = 'md',
  animated = false,
  className,
}: BrandLogoProps) {
  // IDs de gradiente unicos por instancia. Sem isso, multiplas logos na mesma
  // pagina compartilham os mesmos IDs e, se a primeira definicao estiver dentro
  // de um SVG com display:none (ex.: painel desktop oculto no celular), os
  // navegadores mobile (Safari/iOS e alguns Android) nao resolvem o gradiente e
  // a logo aparece em branco/invisivel.
  const uid = useId().replace(/:/g, '');
  const bgGradId = `brand-logo-bg-grad-${uid}`;
  const ringGradId = `brand-logo-ring-grad-${uid}`;
  const text360GradId = `brand-logo-text-360-grad-${uid}`;
  // Size mappings
  const sizeClasses = {
    icon: {
      sm: 'h-8 w-8',
      md: 'h-12 w-12',
      lg: 'h-16 w-16',
    },
    horizontal: {
      sm: 'h-8',
      md: 'h-12',
      lg: 'h-16',
    },
    vertical: {
      sm: 'h-24 w-24',
      md: 'h-36 w-36',
      lg: 'h-48 w-48',
    },
  };

  const currentSizeClass = sizeClasses[variant][size];

  // SVG Definitions
  const renderIcon = (scale: number = 1, translate: string = '0,0') => (
    <g transform={`translate(${translate}) scale(${scale})`}>
      {/* Fundo Arredondado */}
      <rect width="100" height="100" rx="28" fill={`url(#${bgGradId})`} />

      {/* Círculo / Seta 360 (animated selectively) */}
      <g className={animated ? 'animate-spin-360-once' : ''} style={{ transformOrigin: '50px 50px' }}>
        <path
          d="M 67.7,67.7 A 25 25 0 1 1 62.5,28.4"
          stroke={`url(#${ringGradId})`}
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
        />
        <polygon points="67,24 58,33 72,38" fill="#00F0FF" />
      </g>
      
      {/* Pessoa Central Minimalista (stays completely static) */}
      <g>
        <circle cx="50" cy="41" r="6.5" fill="#ffffff" />
        <path d="M 36,62 C 36,55 42,53 50,53 C 58,53 64,55 64,62 Z" fill="#ffffff" />
      </g>
    </g>
  );

  const sharedDefs = (
    <defs>
      <linearGradient id={bgGradId} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#0f2042" />
        <stop offset="100%" stopColor="#081023" />
      </linearGradient>
      <linearGradient id={ringGradId} x1="20" y1="80" x2="80" y2="20" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="60%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#00F0FF" />
      </linearGradient>
      <linearGradient id={text360GradId} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#00b4d8" />
        <stop offset="100%" stopColor="#00F0FF" />
      </linearGradient>
    </defs>
  );

  const textThemeClass = theme === 'dark' ? 'fill-white' : 'fill-[#0f2042]';

  if (variant === 'icon') {
    return (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn('shrink-0 select-none', currentSizeClass, className)}
      >
        {sharedDefs}
        {renderIcon(1, '0,0')}
      </svg>
    );
  }

  if (variant === 'horizontal') {
    const widthClasses = {
      sm: 'w-36',
      md: 'w-52',
      lg: 'w-64',
    };
    return (
      <svg
        viewBox="0 0 360 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn('shrink-0 select-none', currentSizeClass, widthClasses[size], className)}
      >
        {sharedDefs}
        {renderIcon(0.8, '10,10')}
        <text x="110" y="52" className={cn('font-sans font-extrabold text-[34px]', textThemeClass)}>
          Gestão <tspan fill={`url(#${text360GradId})`}>360</tspan>
        </text>
        <text x="112" y="74" fill="#64748b" className="font-sans font-semibold text-[11px] tracking-[0.3em]">
          GESTÃO EMPRESARIAL
        </text>
      </svg>
    );
  }

  // Vertical variant
  return (
    <svg
      viewBox="0 0 200 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 select-none mx-auto', currentSizeClass, className)}
    >
      {sharedDefs}
      {renderIcon(0.8, '60,15')}
      <text x="100" y="125" textAnchor="middle" className={cn('font-sans font-extrabold text-[28px]', textThemeClass)}>
        Gestão <tspan fill={`url(#${text360GradId})`}>360</tspan>
      </text>
      <text x="100" y="148" textAnchor="middle" fill="#64748b" className="font-sans font-semibold text-[9px] tracking-[0.3em]">
        GESTÃO EMPRESARIAL
      </text>
    </svg>
  );
}
