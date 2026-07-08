import { cn } from '@/lib/utils';

/** Bloco de carregamento com shimmer. Compor para formar skeletons de card/tabela. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

/** Skeleton pronto para linhas de tabela/lista (evita repetir o padrão em cada módulo). */
function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export { Skeleton, SkeletonRows };
