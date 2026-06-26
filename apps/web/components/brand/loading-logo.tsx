'use client';

import { cn } from '@/lib/utils';

interface LoadingLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingLogo({ className, size = 'md' }: LoadingLogoProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-10 w-10',
    lg: 'h-16 w-16',
  };

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 select-none', sizeClasses[size], className)}
    >
      <defs>
        <linearGradient id="loading-ring-grad" x1="20" y1="80" x2="80" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="60%" stop-color="#ffffff" />
          <stop offset="100%" stop-color="#00F0FF" />
        </linearGradient>
      </defs>
      {/* Círculo 360 / Seta girando infinitamente */}
      <g className="animate-spin-360-infinite" style={{ transformOrigin: '50px 50px' }}>
        <path
          d="M 67.7,67.7 A 25 25 0 1 1 62.5,28.4"
          stroke="url(#loading-ring-grad)"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
        />
        <polygon points="67,24 58,33 72,38" fill="#00F0FF" />
      </g>
    </svg>
  );
}
